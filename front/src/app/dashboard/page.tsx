"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import type { DashboardStats, DocumentItem } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    const [nextStats, nextDocuments] = await Promise.all([studyApi.stats(), studyApi.documents()]);
    setStats(nextStats);
    setDocuments(nextDocuments);
  }

  useEffect(() => {
    loadData().catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el panel"));
  }, []);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setBusy("upload");
    setError(null);
    setMessage(null);
    try {
      const document = await studyApi.uploadDocument(file);
      setMessage(`Documento cargado: ${document.filename}`);
      input.value = "";
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setBusy(null);
    }
  }

  async function deleteDocument(id: string) {
    setBusy("delete");
    setError(null);
    setMessage(null);
    try {
      await studyApi.deleteDocument(id);
      setMessage("Documento eliminado correctamente");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el documento");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Panel Principal</p>
          <h2>Gestion de Documentos y Estadisticas</h2>
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

      <section className="workspace-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="panel">
          <div className="panel-heading">
            <h3>Tus Documentos de Estudio</h3>
          </div>
          <div className="document-list">
            {documents.map((document) => (
              <article className="mini-card" key={document.id} style={{ display: "flex", justifyContent: "between", alignItems: "center" }}>
                <div style={{ flexGrow: 1 }}>
                  <strong>{document.filename}</strong>
                  <span style={{ display: "block", fontSize: "0.85em", color: "#666", marginTop: "4px" }}>
                    Estado: {document.status} · {document.total_pages} pag. · {document.total_chunks} fragmentos
                  </span>
                </div>
                <button 
                  className="danger-button" 
                  type="button" 
                  disabled={busy === "delete"}
                  onClick={() => void deleteDocument(document.id)}
                >
                  {busy === "delete" ? "Eliminando..." : "Eliminar"}
                </button>
              </article>
            ))}
            {documents.length === 0 && <p className="muted">Sube un archivo PDF para comenzar a trabajar.</p>}
          </div>
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