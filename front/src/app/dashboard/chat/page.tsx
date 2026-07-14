"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import type { ChatResponse, DocumentItem } from "@/lib/types";

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  async function loadDocuments() {
    setError(null);
    const nextDocuments = await studyApi.accessibleDocuments();
    setDocuments(nextDocuments);
  }

  useEffect(() => {
    loadDocuments().catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los documentos"));
  }, []);

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;

    setBusy("chat");
    setError(null);
    try {
      const response = await studyApi.ask(question.trim(), selectedDocumentId || undefined);
      setChat(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La consulta no pudo completarse");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="mb-2">
          <p className="mb-6 text-md font-semibold uppercase tracking-wider text-zinc-800">Asistente Virtual</p>
          <h2 className="text-3xl font-bold text-slate-900">Chat RAG inteligente</h2>
          <p className="mt-2 text-slate-900">Consulta y resuelve dudas interactuando directamente con tus documentos.</p>
        </div>
      </header>

      <div className="mb-6 space-y-3">
        <StatusMessage type="error" message={error} />
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
            <option value="">Todos los documentos (Búsqueda global)</option>
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
          <h3 className="text-lg font-bold text-slate-900">Panel de Conversación</h3>
          <span className="mt-2 sm:mt-0 inline-flex items-center rounded-full border border-slate-200 bg-white/50 px-3 py-1 text-xs font-medium text-slate-600">
            {selectedDocument ? selectedDocument.filename : "Búsqueda global"}
          </span>
        </div>
        
        <div className="px-5 py-5 sm:px-6">
          <form className="flex flex-col gap-4" onSubmit={askQuestion}>
            <textarea
              className="min-h-[120px] w-full resize-y rounded-2xl border-4 border-slate-100 bg-white/40 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-zinc-400 placeholder:text-slate-400"
              maxLength={2000}
              placeholder="Pregunta algo sobre tus documentos..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="flex justify-end">
              <button 
                className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800/90 px-6 py-2.5 font-medium text-white shadow-xl backdrop-blur-3xl transition-colors hover:bg-zinc-800 disabled:bg-slate-400 border border-white/40" 
                disabled={busy === "chat"} 
                type="submit"
              >
                {busy === "chat" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {busy === "chat" ? "Consultando..." : "Preguntar"}
              </button>
            </div>
          </form>

          {chat && (
            <article className="mt-8 rounded-xl border-2 border-white/40 bg-white/60 p-5 md:p-6 shadow-sm backdrop-blur-md">
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{chat.answer}</p>
              
              {chat.sources.length > 0 && (
                <div className="mt-6 border-t border-slate-200/60 pt-4">
                  <strong className="mb-3 block text-sm font-semibold text-slate-900">Fuentes consultadas:</strong>
                  <ul className="flex flex-col gap-3">
                    {chat.sources.map((source, index) => (
                      <li key={`${source.source}-${index}`} className="rounded-lg border border-slate-100 bg-white/40 p-3 text-sm text-slate-700 shadow-sm">
                        <div className="font-medium text-indigo-700/90 mb-1">
                          {source.source}
                          {source.page ? <span className="text-slate-500 font-normal">, página {source.page}</span> : ""}
                        </div>
                        <span className="text-slate-600 italic">"{source.content}"</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )}
        </div>
      </section>
    </AppShell>
  );
}