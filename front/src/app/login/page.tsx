"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/lib/auth";
import { setAccessToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login, reloadUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("access_token");
    if (token) {
      setAccessToken(token);
      window.history.replaceState(null, "", "/login");
      void reloadUser().then(() => router.replace("/dashboard")).catch(() => {
        setError("No se pudo completar el inicio de sesión con Google");
      });
    } else if (new URLSearchParams(window.location.search).get("error") === "google_auth_failed") {
      setError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
    }
  }, [reloadUser, router]);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-yellow-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Inicia sesión</h1>
            <p className="text-gray-500 text-base">Accede a tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-800 px-5 py-4 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-7 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span>O continúa con</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/google`}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-3"
          >
            <span className="text-lg font-bold text-[#4285F4]" aria-hidden="true">G</span>
            Continuar con Google
          </a>

          <div className="mt-10 text-center">
            <p className="text-gray-600 text-sm">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                Crear una
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
