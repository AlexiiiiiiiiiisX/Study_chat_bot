"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Brain, CheckCircle, FileQuestion } from "lucide-react";
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
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="mb-2">
          <p className="mb-6 text-md font-semibold uppercase tracking-wider text-zinc-800">Evaluacion</p>
          <h2 className="text-3xl font-bold text-slate-900">Cuestionarios de Prueba</h2>
          <p className="mt-2 text-slate-900">Pon a prueba tus conocimientos respondiendo preguntas generadas por IA.</p>
        </div>
      </header>

      <div className="mb-6 space-y-3">
        <StatusMessage type="error" message={error} />
        <StatusMessage type="success" message={message} />
      </div>

      <section className="mb-8 overflow-hidden rounded-xl border-r-3 border-b-3 border-white/40 backdrop-blur-3xl bg-white/30 shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Filtro de Contexto</h3>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <select 
            className="w-full max-w-xl rounded-xl border-4 border-slate-100 bg-white/50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-zinc-400"
            value={selectedDocumentId} 
            onChange={(event) => setSelectedDocumentId(event.target.value)}
          >
            <option value="">Selecciona un documento</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border-r-3 border-b-3 border-white/40 backdrop-blur-3xl bg-white/30 shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Quizzes Disponibles</h3>
        </div>
        
        <div className="px-5 py-5 sm:px-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <select
              className="w-full sm:flex-1 max-w-xl rounded-xl border-4 border-slate-100 bg-white/50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-zinc-400"
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
            
            <button 
              className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800/90 px-6 py-3 font-medium text-white shadow-xl backdrop-blur-3xl transition-colors hover:bg-zinc-800 disabled:bg-slate-400 border border-white/40"
              disabled={!selectedDocumentId || busy === "quiz"} 
              onClick={generateQuiz} 
              type="button"
            >
              {busy === "quiz" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {busy === "quiz" ? "Generando..." : "Generar nuevo"}
            </button>
          </div>
          
          {activeQuiz ? (
            <form onSubmit={submitQuiz}>
              <div className="space-y-6">
                {activeQuiz.questions.map((item, questionIndex) => (
                  <fieldset className="rounded-2xl border-2 border-white/40 bg-white/60 p-5 shadow-sm backdrop-blur-md" key={item.id}>
                    <legend className="text-base font-bold text-slate-900 mb-4 w-full border-b border-slate-200/60 pb-3">
                      {questionIndex + 1}. {item.question}
                    </legend>
                    <div className="flex flex-col gap-2 mt-3">
                      {item.options.map((option, optionIndex) => (
                        <label className="flex items-center gap-3 cursor-pointer rounded-lg p-3 transition-colors hover:bg-white/50" key={option}>
                          <input
                            className="h-4 w-4 text-zinc-900 focus:ring-zinc-900"
                            checked={answers[item.id] === optionIndex}
                            name={item.id}
                            required
                            type="radio"
                            onChange={() => setAnswers((current) => ({ ...current, [item.id]: optionIndex }))}
                          />
                          <span className="text-sm text-slate-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-between border-t border-slate-200/60 pt-6">
                <button 
                  className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-indigo-600 px-8 py-3 font-medium text-white shadow-xl backdrop-blur-3xl transition-colors hover:bg-indigo-700 disabled:bg-slate-400 border border-indigo-400/50" 
                  disabled={busy === "submit" || quizResult !== null} 
                  type="submit"
                >
                  {busy === "submit" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  {busy === "submit" ? "Calificando..." : "Calificar Quiz"}
                </button>

                {quizResult && (
                  <div className="rounded-xl bg-indigo-50/80 border border-indigo-100 px-6 py-3 w-full sm:w-auto text-center">
                    <strong className="text-lg font-bold text-indigo-900">
                      Resultado final: {quizResult.score} / {quizResult.total_questions}
                    </strong>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <div className="px-6 py-14 text-center text-slate-500">
              <FileQuestion className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <p>Selecciona un cuestionario existente o genera uno nuevo para practicar.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}