import type {
  ChatResponse,
  DashboardStats,
  DocumentItem,
  Flashcard,
  Quiz,
  QuizSubmitResponse,
  RoomDetail,
  RoomResource,
  RoomSummary,
  TokenResponse,
  User
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ACCESS_TOKEN_KEY = "study_chat_access_token";
const AUTH_SENTINEL = "study_chat_auth=1; path=/; SameSite=Lax";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  formData?: FormData;
  skipAuth?: boolean;
  retry?: boolean;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  document.cookie = `${AUTH_SENTINEL}; max-age=86400`;
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = "study_chat_auth=; path=/; max-age=0; SameSite=Lax";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    let detail = "La solicitud no pudo completarse";
    if (typeof data?.detail === "string") {
      detail = data.detail;
    } else if (Array.isArray(data?.detail)) {
      detail = data.detail
        .map((item: { msg?: string; loc?: Array<string | number> }) => {
          const field = item.loc?.filter((part) => part !== "body").join(".");
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .filter(Boolean)
        .join(" · ");
    }
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

export async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });
  const data = await parseResponse<TokenResponse>(response);
  setAccessToken(data.access_token);
  return data.access_token;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (!options.formData) headers.set("Content-Type", "application/json");
  if (!options.skipAuth && token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined)
  });

  if (response.status === 401 && !options.skipAuth && options.retry !== false) {
    try {
      const refreshed = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${refreshed}`);
      const retryResponse = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers,
        body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined)
      });
      return parseResponse<T>(retryResponse);
    } catch (error) {
      clearAccessToken();
      throw error;
    }
  }

  return parseResponse<T>(response);
}

export const authApi = {
  async login(email: string, password: string) {
    const data = await apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true
    });
    setAccessToken(data.access_token);
    return data;
  },
  register(email: string, password: string) {
    return apiFetch<{ msg: string }>("/auth/register", {
      method: "POST",
      body: { email, password },
      skipAuth: true
    });
  },
  me() {
    return apiFetch<User>("/auth/me");
  },
  refresh: refreshAccessToken,
  async logout() {
    await apiFetch<{ msg: string }>("/auth/logout", { method: "POST", retry: false });
    clearAccessToken();
  }
};

export const studyApi = {
  stats: () => apiFetch<DashboardStats>("/dashboard/me"),
  documents: () => apiFetch<DocumentItem[]>("/documents"),
  async accessibleDocuments() {
    const [owned, shared] = await Promise.all([
      apiFetch<DocumentItem[]>("/documents"),
      apiFetch<RoomResource[]>("/rooms/resources")
    ]);
    const documents = new Map(owned.map((document) => [document.id, document]));
    for (const resource of shared) documents.set(resource.document.id, resource.document);
    return Array.from(documents.values());
  },
  uploadDocument(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentItem>("/documents/upload", { method: "POST", formData });
  },
  deleteDocument: (documentId: string) => apiFetch<{ msg: string }>(`/documents/${documentId}`, { method: "DELETE" }),
  ask: (question: string, documentId?: string) =>
    apiFetch<ChatResponse>("/chat/ask-sync", {
      method: "POST",
      body: { question, document_id: documentId || null }
    }),
  flashcards: (documentId: string) => apiFetch<Flashcard[]>(`/flashcards/document/${documentId}`),
  generateFlashcards: (documentId: string, count: number) =>
    apiFetch<Flashcard[]>("/flashcards/generate", {
      method: "POST",
      body: { document_id: documentId, count }
    }),
  quizzes: (documentId: string) => apiFetch<Quiz[]>(`/quizzes/document/${documentId}`),
  generateQuiz: (documentId: string, count: number) =>
    apiFetch<Quiz>("/quizzes/generate", {
      method: "POST",
      body: { document_id: documentId, count }
    }),
  submitQuiz: (quizId: string, answers: Array<{ question_id: string; selected_index: number }>) =>
    apiFetch<QuizSubmitResponse>(`/quizzes/${quizId}/submit`, {
      method: "POST",
      body: { answers }
    }),
  users: () => apiFetch<User[]>("/admin/users"),
  rooms: () => apiFetch<RoomSummary[]>("/rooms"),
  room: (roomId: string) => apiFetch<RoomDetail>(`/rooms/${roomId}`),
  createRoom: (name: string) =>
    apiFetch<RoomDetail>("/rooms", { method: "POST", body: { name } }),
  joinRoom: (inviteCode: string) =>
    apiFetch<RoomDetail>("/rooms/join", { method: "POST", body: { invite_code: inviteCode } }),
  sharedResources: () => apiFetch<RoomResource[]>("/rooms/resources"),
  shareDocument: (roomId: string, documentId: string) =>
    apiFetch<RoomResource>(`/rooms/${roomId}/resources`, {
      method: "POST",
      body: { document_id: documentId }
    }),
  unshareDocument: (roomId: string, documentId: string) =>
    apiFetch<{ msg: string }>(`/rooms/${roomId}/resources/${documentId}`, { method: "DELETE" }),
  leaveRoom: (roomId: string) =>
    apiFetch<{ msg: string }>(`/rooms/${roomId}/members/me`, { method: "DELETE" }),
  deleteRoom: (roomId: string) =>
    apiFetch<{ msg: string }>(`/rooms/${roomId}`, { method: "DELETE" })
};
