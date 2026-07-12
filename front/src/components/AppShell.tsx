"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { LogOut, LayoutDashboard, MessageSquare, Settings } from 'lucide-react';

const navItems = [
  { href: "/dashboard", label: "Estudio" },
  { href: "/admin", label: "Admin" }
];

export function AppShell({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && requireAdmin && user && user.role !== "admin") router.replace("/dashboard");
  }, [loading, requireAdmin, router, user]);

  if (loading) {
    return (
      <main className="center-page">
        <div className="loader" />
        <p>Validando sesión...</p>
      </main>
    );
  }

  if (!user || (requireAdmin && user.role !== "admin")) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
            Study Chat Bot
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Panel</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {/* Puedes agregar iconos aquí */}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Box */}
        <div className="p-4 border-t border-slate-200">
          <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
            <p className="text-xs text-slate-500 mt-1 capitalize">{user.role}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace('/login'))}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-red-50 hover:text-red-700 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <section className="p-8">
          {children}
        </section>
      </main>
    </div>
  );
}
