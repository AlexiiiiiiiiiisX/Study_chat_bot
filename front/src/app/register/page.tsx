"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await register(email, password));
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Crea tu cuenta" subtitle="Usa una contraseña fuerte: mayúscula, minúscula, número y símbolo.">
      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          Correo
          <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Contraseña
          <input
            autoComplete="new-password"
            minLength={8}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <StatusMessage type="success" message={message} />
        <StatusMessage type="error" message={error} />
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
      <p className="auth-link">
        ¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link>
      </p>
    </AuthShell>
  );
}
