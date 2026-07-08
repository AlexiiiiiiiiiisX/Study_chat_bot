"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-300 min-h-screen flex items-center justify-center ">
      <AuthShell title="Inicia sesión" subtitle="Accede a tus documentos, preguntas, tarjetas y quizzes.">
        <div>
        <form onSubmit={handleSubmit}>
          <label>
            Correo
            <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Contraseña
            <input
              autoComplete="current-password"
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <StatusMessage type="error" message={error} />
          <button disabled={loading} type="submit">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p>
          ¿No tienes cuenta? <Link href="/register">Crear cuenta</Link>
        </p>
        </div>
      </AuthShell>
    </div>
  );
}
