"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import type { DocumentItem, Quiz, QuizSubmitResponse } from "@/lib/types";

export default function QuizzesPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDocuments() {
    setError(null);
    try {
      const nextDocuments = await studyApi.accessibleDocuments();
      setDocuments(nextDocuments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar documentos");
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    if (!selectedDocumentId) {
      setQuizzes([]);
      setActiveQuiz(null);
      return;
    }

    studyApi.quizzes(selectedDocumentId)
      .then((nextQuizzes) => {
        setQuizzes(nextQuizzes);
        setActiveQuiz(nextQuizzes[0] ?? null);
        setAnswers({});
        setQuizResult(null);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar los cuestionarios"));
  }, [selectedDocumentId]);

  async function generateQuiz() {
    if (!selectedDocumentId) return;
    setBusy("quiz");
    setError(null);
    setMessage(null);
    
    try {
      const quiz = await studyApi.generateQuiz(selectedDocumentId, 5);
      setQuizzes((current) => [quiz, ...current]);
      setActiveQuiz(quiz);
      setAnswers({});
      setQuizResult(null);
      setMessage("Quiz generado correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar quiz");
    } finally {
      setBusy(null);
    }
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeQuiz) return;
    
    setBusy("submit");
    setError(null);
    
    try {
      const payload = activeQuiz.questions.map((item) => ({
        question_id: item.id,
        selected_index: answers[item.id] ?? -1
      }));
      const result = await studyApi.submitQuiz(activeQuiz.id, payload);
      setQuizResult(result);
      setMessage("Respuestas enviadas correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al calificar el quiz");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Evaluacion</p>
          <h2>Cuestionarios de Prueba</h2>
        </div>
      </header>

      <StatusMessage type="error" message={error} />
      <StatusMessage type="success" message={message} />

      <div className="panel">
        <div className="panel-heading">
          <h3>Filtro de Contexto</h3>
          <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
            <option value="">Selecciona un documento</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginTop: "20px" }}>
        <div className="panel-heading">
          <h3>Quizzes Disponibles</h3>
          <div className="button-row">
            <select
              value={activeQuiz?.id ?? ""}
              onChange={(event) => {
                setActiveQuiz(quizzes.find((quiz) => quiz.id === event.target.value) ?? null);
                setQuizResult(null);
                setAnswers({});
                setMessage(null);
              }}
            >
              <option value="">Sin quiz seleccionado</option>
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title}
                </option>
              ))}
            </select>
            <button className="secondary-button" disabled={!selectedDocumentId || busy === "quiz"} onClick={generateQuiz} type="button">
              {busy === "quiz" ? "Generando..." : "Generar nuevo"}
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
              {busy === "submit" ? "Calificando..." : "Calificar"}
            </button>
            {quizResult && (
              <div className="result-box">
                Resultado final: {quizResult.score}/{quizResult.total_questions}
              </div>
            )}
          </form>
        ) : (
          <p className="muted">Selecciona o genera un quiz para practicar.</p>
        )}
      </div>
    </AppShell>
  );
}
