"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
    const nextDocuments = await studyApi.documents();
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
      <header className="page-header">
        <div>
          <p className="eyebrow">Asistente Virtual</p>
          <h2>Chat RAG inteligente</h2>
        </div>
      </header>

      <StatusMessage type="error" message={error} />

      <div className="panel">
        <div className="panel-heading">
          <h3>Filtro de Contexto</h3>
          <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
            <option value="">Todos los documentos (Búsqueda global)</option>
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
          <h3>Panel de Conversación</h3>
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
    </AppShell>
  );
}