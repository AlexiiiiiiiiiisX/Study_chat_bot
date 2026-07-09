"use client";

import { useEffect, useState } from "react";
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
      const nextDocuments = await studyApi.documents();
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
      <header className="page-header">
        <div>
          <p className="eyebrow">Repaso Activo</p>
          <h2>Tarjetas de Estudio</h2>
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
          <h3>Tus Tarjetas</h3>
          <button className="secondary-button" disabled={!selectedDocumentId || busy === "flashcards"} onClick={generateFlashcards} type="button">
            {busy === "flashcards" ? "Generando..." : "Generar 8 nuevas"}
          </button>
        </div>
        <div className="cards-grid">
          {flashcards.map((card) => (
            <article className="study-card" key={card.id}>
              <strong>{card.question}</strong>
              <p>{card.answer}</p>
              {card.page_reference && <small>Pagina {card.page_reference}</small>}
            </article>
          ))}
          {flashcards.length === 0 && <p className="muted">Selecciona un documento para ver o generar tarjetas.</p>}
        </div>
      </div>
    </AppShell>
  );
}