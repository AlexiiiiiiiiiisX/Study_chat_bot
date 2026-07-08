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
