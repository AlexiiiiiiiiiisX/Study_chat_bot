"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import type { ChatResponse, DashboardStats, DocumentItem, Flashcard, Quiz, QuizSubmitResponse } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  async function loadData() {
    setError(null);
    const [nextStats, nextDocuments] = await Promise.all([studyApi.stats(), studyApi.documents()]);
    setStats(nextStats);
    setDocuments(nextDocuments);
    setSelectedDocumentId((current) =>
      nextDocuments.some((document) => document.id === current) ? current : nextDocuments[0]?.id || ""
    );
  }

  useEffect(() => {
    loadData().catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el panel"));
  }, []);

  useEffect(() => {
    if (!selectedDocumentId) {
      setFlashcards([]);
      setQuizzes([]);
      setActiveQuiz(null);
      return;
    }

    Promise.all([studyApi.flashcards(selectedDocumentId), studyApi.quizzes(selectedDocumentId)])
      .then(([nextFlashcards, nextQuizzes]) => {
        setFlashcards(nextFlashcards);
        setQuizzes(nextQuizzes);
        setActiveQuiz(nextQuizzes[0] ?? null);
        setAnswers({});
        setQuizResult(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los recursos"));
  }, [selectedDocumentId]);

  async function withBusy(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "La operación no pudo completarse");
    } finally {
      setBusy(null);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await withBusy("upload", async () => {
      const document = await studyApi.uploadDocument(file);
      setMessage(`Documento cargado: ${document.filename}`);
      input.value = "";
      await loadData();
      setSelectedDocumentId(document.id);
    });
  }

  async function deleteDocument(documentId: string, filename: string) {
    await withBusy("delete", async () => {
      await studyApi.deleteDocument(documentId);
      setMessage(`Documento eliminado: ${filename}`);
      await loadData();
    });
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    await withBusy("chat", async () => {
      setChat(await studyApi.ask(question.trim(), selectedDocumentId || undefined));
    });
  }

  async function generateFlashcards() {
    if (!selectedDocumentId) return;
    await withBusy("flashcards", async () => {
      setFlashcards(await studyApi.generateFlashcards(selectedDocumentId, 8));
      setMessage("Flashcards generadas correctamente");
      await loadData();
    });
  }

  async function generateQuiz() {
    if (!selectedDocumentId) return;
    await withBusy("quiz", async () => {
      const quiz = await studyApi.generateQuiz(selectedDocumentId, 5);
      setQuizzes((current) => [quiz, ...current]);
      setActiveQuiz(quiz);
      setAnswers({});
      setQuizResult(null);
      setMessage("Quiz generado correctamente");
    });
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeQuiz) return;
    await withBusy("submit", async () => {
      const payload = activeQuiz.questions.map((item) => ({
        question_id: item.id,
        selected_index: answers[item.id] ?? -1
      }));
      setQuizResult(await studyApi.submitQuiz(activeQuiz.id, payload));
      await loadData();
    });
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Estudio</h1>
            <p className="text-gray-600 mb-8">Chat, documentos y práctica</p>

            <form className="flex gap-3" onSubmit={uploadDocument}>
              <input
                accept="application/pdf"
                name="file"
                required
                type="file"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              />
              <button
                disabled={busy === 'upload'}
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center gap-2"
              >
                {busy === 'upload' && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy === 'upload' ? 'Subiendo...' : 'Subir PDF'}
              </button>
            </form>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-100 border border-red-300 text-red-800 px-6 py-4 rounded-lg flex justify-between items-start">
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {message && (
            <div className="mb-6 bg-green-100 border border-green-300 text-green-800 px-6 py-4 rounded-lg flex justify-between items-start">
              <p className="text-sm font-medium">{message}</p>
              <button onClick={() => setMessage(null)} className="text-green-600 hover:text-green-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm font-medium mb-2">Documentos</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_documents ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm font-medium mb-2">Flashcards</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_flashcards ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm font-medium mb-2">Intentos quiz</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_quiz_attempts ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm font-medium mb-2">Promedio</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.average_quiz_score_pct ?? 0}%</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Documents Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Documentos</h2>
                <select
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-sm"
                >
                  <option value="">Todos los documentos</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.filename}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className={`p-4 rounded-lg border transition-all ${document.id === selectedDocumentId
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDocumentId(document.id)}
                      className="w-full text-left mb-3"
                    >
                      <p className="font-semibold text-gray-900">{document.filename}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {document.status} · {document.total_pages} pág. · {document.total_chunks} chunks
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDocument(document.id, document.filename)}
                      disabled={busy === "delete"}
                      className="w-full px-3 py-2 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 text-red-700 font-medium text-sm rounded transition"
                    >
                      {busy === "delete" ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                ))}
                {documents.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">Sube un PDF para comenzar.</p>
                )}
              </div>
            </div>

            {/* Chat Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[32rem]">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Chat RAG</h2>
                <p className="text-xs text-gray-500">
                  {selectedDocument ? selectedDocument.filename : 'Búsqueda global'}
                </p>
              </div>
              <div className="flex-1 min-h-0 p-6 overflow-y-auto">
                {chat && (
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 mb-4">
                    <p className="text-gray-800 text-sm leading-relaxed mb-4 max-h-64 overflow-y-auto pr-2 whitespace-pre-wrap">
                      {chat.answer}
                    </p>
                    {chat.sources && chat.sources.length > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-3">Fuentes</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {chat.sources.map((source, index) => (
                            <p key={`${source.source}-${index}`} className="text-xs text-gray-600 break-words">
                              <span className="font-medium">{source.source}</span>
                              {source.page && <span className="text-gray-500">, página {source.page}</span>}: {source.content}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="px-6 py-5 border-t border-gray-200">
                <form
                  className="flex gap-3"
                  onSubmit={askQuestion}
                >
                  <textarea
                    maxLength={2000}
                    placeholder="Pregunta algo sobre tus documentos..."
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-sm resize-none max-h-24"
                    rows={2}
                  />
                  <button
                    type="submit"
                    disabled={busy === 'chat'}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition whitespace-nowrap flex items-center gap-2"
                  >
                    {busy === 'chat' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy === 'chat' ? 'Consultando...' : 'Preguntar'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Flashcards and Quizzes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Flashcards Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Flashcards</h2>
                <button
                  disabled={!selectedDocumentId || busy === 'flashcards'}
                  onClick={() => void generateFlashcards()}
                  type="button"
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-medium text-sm rounded-lg transition"
                >
                  Generar 8
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {flashcards.map((card) => (
                  <div key={card.id} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200">
                    <p className="font-semibold text-gray-900 text-sm mb-3 max-h-28 overflow-y-auto break-words pr-1">{card.question}</p>
                    <p className="text-gray-700 text-sm mb-3 max-h-32 overflow-y-auto break-words pr-1">{card.answer}</p>
                    {card.page_reference && <p className="text-xs text-gray-500">Página {card.page_reference}</p>}
                  </div>
                ))}
                {flashcards.length === 0 && (
                  <p className="text-gray-500 text-sm col-span-2 text-center py-8">
                    Selecciona un documento y genera tarjetas.
                  </p>
                )}
              </div>
            </div>

            {/* Quizzes Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quizzes</h2>
                <div className="flex gap-3">
                  <select
                    value={activeQuiz?.id ?? ''}
                    onChange={(event) => {
                      setActiveQuiz(quizzes.find((quiz) => quiz.id === event.target.value) ?? null)
                      setQuizResult(null)
                      setAnswers({})
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-sm"
                  >
                    <option value="">Sin quiz</option>
                    {quizzes.map((quiz) => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title}
                      </option>
                    ))}
                  </select>
                  <button
                  disabled={!selectedDocumentId || busy === 'quiz'}
                  onClick={() => void generateQuiz()}
                    type="button"
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-medium text-sm rounded-lg transition whitespace-nowrap"
                  >
                    Generar
                  </button>
                </div>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                {activeQuiz ? (
                  <form className="space-y-6" onSubmit={submitQuiz}>
                    {activeQuiz.questions.map((item, questionIndex) => (
                      <div key={item.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                        <p className="font-semibold text-gray-900 mb-3 text-sm max-h-28 overflow-y-auto break-words pr-1">
                          {questionIndex + 1}. {item.question}
                        </p>
                        <div className="space-y-2">
                          {item.options.map((option, optionIndex) => (
                            <label key={option} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition">
                              <input
                                checked={answers[item.id] === optionIndex}
                                name={item.id}
                                type="radio"
                                onChange={() => setAnswers((current) => ({ ...current, [item.id]: optionIndex }))}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-gray-700 text-sm">{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      disabled={busy === 'submit'}
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition mt-6 flex items-center justify-center gap-2"
                    >
                      {busy === 'submit' && <Loader2 className="h-4 w-4 animate-spin" />}
                      Calificar
                    </button>
                    {quizResult && (
                      <div className="bg-green-50 border border-green-300 rounded-lg p-4 mt-4">
                        <p className="text-green-800 font-semibold text-sm">
                          Resultado: {quizResult.score}/{quizResult.total_questions}
                        </p>
                      </div>
                    )}
                  </form>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">
                    Selecciona o genera un quiz para practicar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
