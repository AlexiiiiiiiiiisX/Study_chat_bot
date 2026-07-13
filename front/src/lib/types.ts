export type User = {
  id: string;
  email: string;
  role: "admin" | "student" | string;
  is_verified: boolean;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type DashboardStats = {
  total_documents: number;
  total_flashcards: number;
  total_quiz_attempts: number;
  average_quiz_score_pct: number;
  last_activity: string | null;
};

export type DocumentItem = {
  id: string;
  filename: string;
  total_pages: number;
  total_chunks: number;
  status: string;
  created_at: string;
};

export type SourceChunk = {
  content: string;
  source: string;
  page: number | null;
  score: number | null;
};

export type ChatResponse = {
  answer: string;
  sources: SourceChunk[];
  session_id: string;
};

export type Flashcard = {
  id: string;
  question: string;
  answer: string;
  page_reference: number | null;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  page_reference: number | null;
};

export type Quiz = {
  id: string;
  title: string;
  created_at: string;
  questions: QuizQuestion[];
};

export type QuizSubmitResponse = {
  score: number;
  total_questions: number;
  results: Array<{
    question_id: string;
    correct: boolean;
    correct_index: number;
    explanation: string | null;
  }>;
};

export type RoomMember = {
  user_id: string;
  email: string;
  role: "owner" | "member";
  joined_at: string;
};

export type RoomSummary = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  role: "owner" | "member";
  member_count: number;
  resource_count: number;
  created_at: string;
};

export type RoomResource = {
  id: string;
  room_id: string;
  room_name: string;
  document: DocumentItem;
  shared_by_id: string;
  shared_by_email: string;
  shared_at: string;
};

export type RoomDetail = RoomSummary & {
  members: RoomMember[];
  resources: RoomResource[];
};
