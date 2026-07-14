"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import type { DocumentItem, Flashcard } from "@/lib/types";

export default function FlashcardsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
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
      setFlashcards([]);
      return;
    }

    studyApi.flashcards(selectedDocumentId)
      .then((nextFlashcards) => {
        setFlashcards(nextFlashcards);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar las tarjetas"));
  }, [selectedDocumentId]);

  async function generateFlashcards() {
    if (!selectedDocumentId) return;
    setBusy("flashcards");
    setError(null);
    setMessage(null);
    
    try {
      const newCards = await studyApi.generateFlashcards(selectedDocumentId, 8);
      setFlashcards(newCards);
      setMessage("Tarjetas generadas correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar tarjetas");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="mb-2">
          <p className="mb-6 text-md font-semibold uppercase tracking-wider text-zinc-800">Repaso Activo</p>
          <h2 className="text-3xl font-bold text-slate-900">Tarjetas de Estudio</h2>
          <p className="mt-2 text-slate-900">Memoriza conceptos clave con tarjetas generadas a partir de tus documentos.</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Tus Tarjetas</h3>
          <button 
            className="mt-4 sm:mt-0 flex items-center justify-center gap-2 rounded-lg bg-zinc-800/90 px-6 py-2.5 font-medium text-white shadow-xl backdrop-blur-3xl transition-colors hover:bg-zinc-800 disabled:bg-slate-400 border border-white/40"
            disabled={!selectedDocumentId || busy === "flashcards"} 
            onClick={generateFlashcards} 
            type="button"
          >
            {busy === "flashcards" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy === "flashcards" ? "Generando..." : "Generar 8 nuevas"}
          </button>
        </div>
        
        <div className="px-5 py-5 sm:px-6">
          {flashcards.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {flashcards.map((card) => (
                <article className="flex flex-col justify-between rounded-2xl border-2 border-white/40 bg-white/60 p-5 shadow-sm backdrop-blur-md" key={card.id}>
                  <div>
                    <strong className="block text-base font-bold text-slate-900 mb-3">{card.question}</strong>
                    <p className="text-sm text-slate-700 leading-relaxed">{card.answer}</p>
                  </div>
                  {card.page_reference && (
                    <small className="mt-4 inline-flex self-start rounded-md bg-indigo-50/80 px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
                      Página {card.page_reference}
                    </small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="px-6 py-14 text-center text-slate-500">
              <Layers className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <p>Selecciona un documento para ver o generar tarjetas de estudio.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}