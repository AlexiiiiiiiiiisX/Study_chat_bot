"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
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

  async function deleteDocument(document: DocumentItem) {
    setBusy(`delete:${document.id}`);
    setError(null);
    setMessage(null);
    try {
      await studyApi.deleteDocument(document.id);
      setMessage(`Documento eliminado: ${document.filename}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el documento");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">Panel principal</p>
          <h2 className="text-3xl font-bold text-slate-900">Tus documentos de estudio</h2>
          <p className="mt-2 text-slate-600">Administra tus fuentes y consulta tu progreso general.</p>
        </div>
        <form className="flex w-full max-w-xl flex-col gap-3 sm:flex-row" onSubmit={uploadDocument}>
          <input
            accept="application/pdf"
            aria-label="Seleccionar documento PDF"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            name="file"
            required
            type="file"
          />
          <button
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
            disabled={busy === "upload"}
            type="submit"
          >
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy === "upload" ? "Subiendo..." : "Subir PDF"}
          </button>
        </form>
      </header>

      <div className="mb-6 space-y-3">
        <StatusMessage type="error" message={error} />
        <StatusMessage type="success" message={message} />
      </div>

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumen de actividad">
        <Stat label="Documentos" value={stats?.total_documents ?? 0} />
        <Stat label="Flashcards" value={stats?.total_flashcards ?? 0} />
        <Stat label="Intentos quiz" value={stats?.total_quiz_attempts ?? 0} />
        <Stat label="Promedio" value={`${stats?.average_quiz_score_pct ?? 0}%`} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Documentos</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {documents.map((document) => {
            const deleting = busy === `delete:${document.id}`;
            return (
              <article className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={document.id}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><FileText className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <strong className="block truncate text-slate-900">{document.filename}</strong>
                    <span className="mt-1 block text-sm text-slate-500">
                      {document.status} · {document.total_pages} páginas 
                    </span>
                  </div>
                </div>
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                  type="button"
                  disabled={deleting || busy === "upload"}
                  onClick={() => void deleteDocument(document)}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
              </article>
            );
          })}
          {documents.length === 0 && (
            <div className="px-6 py-14 text-center text-slate-500">
              <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <p>Sube un archivo PDF para comenzar a estudiar.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <strong className="mt-2 block text-3xl font-bold text-slate-900">{value}</strong>
    </article>
  );
}
