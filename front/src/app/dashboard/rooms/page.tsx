"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Copy,
  DoorOpen,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  UserRound,
  Users
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DocumentItem, RoomDetail, RoomSummary } from "@/lib/types";

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadOverview(preferredRoomId?: string) {
    const [nextRooms, nextDocuments] = await Promise.all([studyApi.rooms(), studyApi.documents()]);
    setRooms(nextRooms);
    setDocuments(nextDocuments);
    setSelectedRoomId((current) => {
      const candidate = preferredRoomId || current;
      return nextRooms.some((item) => item.id === candidate) ? candidate : nextRooms[0]?.id || "";
    });
  }

  async function loadRoom(roomId: string) {
    if (!roomId) {
      setRoom(null);
      return;
    }
    setBusy("room");
    setError(null);
    try {
      setRoom(await studyApi.room(roomId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la sala");
      setRoom(null);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    loadOverview()
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las salas"))
      .finally(() => setBusy(null));
  }, []);

  useEffect(() => {
    void loadRoom(selectedRoomId);
  }, [selectedRoomId]);

  async function runAction(label: string, action: () => Promise<void>) {
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

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    await runAction("create", async () => {
      const created = await studyApi.createRoom(name);
      form.reset();
      setMessage(`Sala creada: ${created.name}`);
      await loadOverview(created.id);
    });
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = (form.elements.namedItem("code") as HTMLInputElement).value;
    await runAction("join", async () => {
      const joined = await studyApi.joinRoom(code);
      form.reset();
      setMessage(`Te uniste a ${joined.name}`);
      await loadOverview(joined.id);
    });
  }

  async function shareDocument() {
    if (!room || !selectedDocumentId) return;
    await runAction("share", async () => {
      await studyApi.shareDocument(room.id, selectedDocumentId);
      setSelectedDocumentId("");
      setMessage("Documento compartido con la sala");
      await loadOverview(room.id);
      await loadRoom(room.id);
    });
  }

  async function unshareDocument(documentId: string) {
    if (!room) return;
    await runAction(`unshare:${documentId}`, async () => {
      await studyApi.unshareDocument(room.id, documentId);
      setMessage("Recurso retirado de la sala");
      await loadOverview(room.id);
      await loadRoom(room.id);
    });
  }

  async function leaveOrDeleteRoom() {
    if (!room) return;
    const isOwner = room.role === "owner";
    const prompt = isOwner
      ? "¿Eliminar esta sala? Se perderán sus membresías y recursos compartidos."
      : "¿Salir de esta sala? Dejarás de acceder a sus recursos compartidos.";
    if (!window.confirm(prompt)) return;
    await runAction("leave", async () => {
      if (isOwner) await studyApi.deleteRoom(room.id);
      else await studyApi.leaveRoom(room.id);
      setMessage(isOwner ? "Sala eliminada" : "Saliste de la sala");
      setRoom(null);
      setSelectedRoomId("");
      await loadOverview();
    });
  }

  async function copyInviteCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.invite_code);
      setMessage("Código de invitación copiado");
    } catch {
      setError("No se pudo copiar el código; puedes seleccionarlo manualmente");
    }
  }

  const sharedDocumentIds = new Set(room?.resources.map((resource) => resource.document.id) ?? []);
  const shareableDocuments = documents.filter(
    (document) => document.status === "ready" && !sharedDocumentIds.has(document.id)
  );

  return (
    <AppShell>
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">Estudio colaborativo</p>
        <h2 className="text-3xl font-bold text-slate-900">Salas de estudio</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Comparte tus documentos y utilízalos con tu grupo en Chat RAG, Flashcards y Quizzes.
        </p>
      </header>

      <div className="mb-6 space-y-3">
        <StatusMessage type="error" message={error} />
        <StatusMessage type="success" message={message} />
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={createRoom}>
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><DoorOpen className="h-5 w-5" /></span>
            <div><h3 className="font-bold text-slate-900">Crear una sala</h3><p className="text-sm text-slate-500">Serás propietario y podrás invitar estudiantes.</p></div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input name="name" minLength={3} maxLength={120} placeholder="Ej. Biología — Grupo 9A" required />
            <button className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={busy === "create"} type="submit">
              {busy === "create" ? "Creando..." : "Crear"}
            </button>
          </div>
        </form>

        <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={joinRoom}>
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><LogIn className="h-5 w-5" /></span>
            <div><h3 className="font-bold text-slate-900">Unirse a una sala</h3><p className="text-sm text-slate-500">Usa el código que compartió el propietario.</p></div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input className="uppercase" name="code" minLength={6} maxLength={12} placeholder="CÓDIGO" required />
            <button className="rounded-lg bg-slate-800 px-5 py-2 font-medium text-white hover:bg-slate-900 disabled:opacity-60" disabled={busy === "join"} type="submit">
              {busy === "join" ? "Uniéndote..." : "Unirse"}
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold text-slate-900">Mis salas</h3></div>
          <div className="divide-y divide-slate-100">
            {rooms.map((item) => (
              <button
                className={`w-full px-5 py-4 text-left transition ${selectedRoomId === item.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                key={item.id}
                onClick={() => setSelectedRoomId(item.id)}
                type="button"
              >
                <strong className="block truncate text-slate-900">{item.name}</strong>
                <span className="mt-1 block text-xs text-slate-500">{item.member_count} miembros · {item.resource_count} recursos</span>
              </button>
            ))}
            {!rooms.length && busy !== "load" && <p className="px-5 py-8 text-center text-sm text-slate-500">Todavía no tienes salas.</p>}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          {busy === "room" && !room ? (
            <div className="flex min-h-80 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando sala...</div>
          ) : room ? (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-slate-900">{room.name}</h3>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <span>Código:</span><code className="rounded bg-slate-100 px-2 py-1 font-bold text-slate-800">{room.invite_code}</code>
                    <button className="rounded p-1 hover:bg-slate-100" onClick={() => void copyInviteCode()} title="Copiar código" type="button"><Copy className="h-4 w-4" /></button>
                  </div>
                </div>
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  disabled={busy === "leave"}
                  onClick={() => void leaveOrDeleteRoom()}
                  type="button"
                >
                  {room.role === "owner" ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  {room.role === "owner" ? "Eliminar sala" : "Salir de la sala"}
                </button>
              </div>

              <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><h4 className="font-bold text-slate-900">Recursos compartidos</h4><p className="text-sm text-slate-500">Los miembros pueden utilizarlos desde las herramientas de estudio.</p></div>
                  </div>
                  <div className="mb-5 flex flex-col gap-3 rounded-lg bg-slate-50 p-4 sm:flex-row">
                    <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
                      <option value="">Selecciona uno de tus documentos</option>
                      {shareableDocuments.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}
                    </select>
                    <button className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={!selectedDocumentId || busy === "share"} onClick={() => void shareDocument()} type="button">
                      {busy === "share" ? "Compartiendo..." : "Compartir"}
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {room.resources.map((resource) => {
                      const canRemove = room.role === "owner" || resource.shared_by_id === user?.id;
                      return (
                        <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={resource.id}>
                          <div className="flex min-w-0 items-start gap-3">
                            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            <div className="min-w-0"><strong className="block truncate text-slate-900">{resource.document.filename}</strong><span className="text-xs text-slate-500">Compartido por {resource.shared_by_email}</span></div>
                          </div>
                          {canRemove && (
                            <button className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" disabled={busy === `unshare:${resource.document.id}`} onClick={() => void unshareDocument(resource.document.id)} type="button">
                              Retirar
                            </button>
                          )}
                        </article>
                      );
                    })}
                    {!room.resources.length && <p className="p-8 text-center text-sm text-slate-500">Aún no hay documentos compartidos.</p>}
                  </div>
                </div>

                <aside>
                  <div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /><h4 className="font-bold text-slate-900">Miembros ({room.members.length})</h4></div>
                  <div className="space-y-2">
                    {room.members.map((member) => (
                      <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3" key={member.user_id}>
                        <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{member.email}</p><p className="text-xs capitalize text-slate-500">{member.role === "owner" ? "Propietario" : "Miembro"}</p></div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center text-slate-500">
              <Users className="mb-3 h-10 w-10 text-slate-300" /><p className="font-medium">Crea una sala o únete con un código.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
