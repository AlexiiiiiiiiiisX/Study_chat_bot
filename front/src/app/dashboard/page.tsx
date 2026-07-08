"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
      <header className="page-header">
        <div>
          <p className="eyebrow">Estudio</p>
          <h2>Chat, documentos y práctica</h2>
        </div>
        <form className="upload-form" onSubmit={uploadDocument}>
          <input accept="application/pdf" name="file" required type="file" />
          <button className="primary-button" disabled={busy === "upload"} type="submit">
            {busy === "upload" ? "Subiendo..." : "Subir PDF"}
          </button>
        </form>
      </header>

      <StatusMessage type="error" message={error} />
      <StatusMessage type="success" message={message} />

      <section className="stats-grid">
        <Stat label="Documentos" value={stats?.total_documents ?? 0} />
        <Stat label="Flashcards" value={stats?.total_flashcards ?? 0} />
        <Stat label="Intentos quiz" value={stats?.total_quiz_attempts ?? 0} />
        <Stat label="Promedio" value={`${stats?.average_quiz_score_pct ?? 0}%`} />
      </section>

      <section className="workspace-grid">
        <div className="panel">
          <div className="panel-heading">
            <h3>Documentos</h3>
            <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
              <option value="">Todos los documentos</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.filename}
                </option>
              ))}
            </select>
          </div>
          <div className="document-list">
            {documents.map((document) => (
              <article className={document.id === selectedDocumentId ? "mini-card selected" : "mini-card"} key={document.id}>
                <button type="button" onClick={() => setSelectedDocumentId(document.id)}>
                  <strong>{document.filename}</strong>
                  <span>
                    {document.status} · {document.total_pages} pág. · {document.total_chunks} chunks
                  </span>
                </button>
                <button className="danger-button" type="button" onClick={() => void withBusy("delete", async () => {
                  await studyApi.deleteDocument(document.id);
                  await loadData();
                })}>
                  Eliminar
                </button>
              </article>
            ))}
            {documents.length === 0 && <p className="muted">Sube un PDF para comenzar.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h3>Chat RAG</h3>
            <span className="muted">{selectedDocument ? selectedDocument.filename : "Búsqueda global"}</span>
          </div>
          <form className="chat-form" onSubmit={askQuestion}>
            <textarea
              maxLength={2000}
              placeholder="Pregunta algo sobre tus documentos..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button className="primary-button" disabled={busy === "chat"} type="submit">
              {busy === "chat" ? "Consultando..." : "Preguntar"}
            </button>
          </form>
          {chat && (
            <article className="answer-box">
              <p>{chat.answer}</p>
              {chat.sources.length > 0 && (
                <div className="sources">
                  <strong>Fuentes</strong>
                  {chat.sources.map((source, index) => (
                    <small key={`${source.source}-${index}`}>
                      {source.source}
                      {source.page ? `, página ${source.page}` : ""}: {source.content}
                    </small>
                  ))}
                </div>
              )}
            </article>
          )}
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel">
          <div className="panel-heading">
            <h3>Flashcards</h3>
            <button className="secondary-button" disabled={!selectedDocumentId || busy === "flashcards"} onClick={generateFlashcards} type="button">
              Generar 8
            </button>
          </div>
          <div className="cards-grid">
            {flashcards.map((card) => (
              <article className="study-card" key={card.id}>
                <strong>{card.question}</strong>
                <p>{card.answer}</p>
                {card.page_reference && <small>Página {card.page_reference}</small>}
              </article>
            ))}
            {flashcards.length === 0 && <p className="muted">Selecciona un documento y genera tarjetas.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h3>Quizzes</h3>
            <div className="button-row">
              <select
                value={activeQuiz?.id ?? ""}
                onChange={(event) => {
                  setActiveQuiz(quizzes.find((quiz) => quiz.id === event.target.value) ?? null);
                  setQuizResult(null);
                  setAnswers({});
                }}
              >
                <option value="">Sin quiz</option>
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
              <button className="secondary-button" disabled={!selectedDocumentId || busy === "quiz"} onClick={generateQuiz} type="button">
                Generar
              </button>
            </div>
          </div>
          {activeQuiz ? (
            <form className="quiz-form" onSubmit={submitQuiz}>
              {activeQuiz.questions.map((item, questionIndex) => (
                <fieldset key={item.id}>
                  <legend>{questionIndex + 1}. {item.question}</legend>
                  {item.options.map((option, optionIndex) => (
                    <label className="radio-row" key={option}>
                      <input
                        checked={answers[item.id] === optionIndex}
                        name={item.id}
                        required
                        type="radio"
                        onChange={() => setAnswers((current) => ({ ...current, [item.id]: optionIndex }))}
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              ))}
              <button className="primary-button" disabled={busy === "submit"} type="submit">
                Calificar
              </button>
              {quizResult && (
                <div className="result-box">
                  Resultado: {quizResult.score}/{quizResult.total_questions}
                </div>
              )}
            </form>
          ) : (
            <p className="muted">Selecciona o genera un quiz para practicar.</p>
          )}
        </div>
      </section>
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
