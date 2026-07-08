"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusMessage } from "@/components/StatusMessage";
import { studyApi } from "@/lib/api";
import type { User } from "@/lib/types";

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studyApi
      .users()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar usuarios"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell requireAdmin>
      <header className="page-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h2>Usuarios registrados</h2>
        </div>
      </header>

      <StatusMessage type="error" message={error} />

      <section className="panel">
        {loading ? (
          <p className="muted">Cargando usuarios...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Verificado</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.is_verified ? "Sí" : "No"}</td>
                    <td>{new Date(user.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
