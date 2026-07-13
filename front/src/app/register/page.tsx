"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";


export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== passwordConfirmation) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      setMessage(await register(email, password));
      setEmail("");
      setPassword("");
      setPasswordConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-200 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Crear cuenta</h1>
            <p className="text-gray-500 text-base">Únete a nuestra plataforma</p>
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
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-2">Mínimo 8 caracteres</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Confirmar contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                aria-invalid={passwordConfirmation.length > 0 && password !== passwordConfirmation}
                className="w-full px-5 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
              />
              {passwordConfirmation.length > 0 && password !== passwordConfirmation && (
                <p className="text-xs text-red-600 mt-2">Las contraseñas no coinciden</p>
              )}
            </div>

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-800 px-5 py-4 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-100 border border-green-300 text-green-800 px-5 py-4 rounded-lg text-sm font-medium">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
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
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
