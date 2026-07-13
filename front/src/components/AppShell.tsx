"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Layers3,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Users
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "Chat RAG", icon: MessageSquare },
  { href: "/dashboard/flashcards", label: "Flashcards", icon: Layers3 },
  { href: "/dashboard/quizzes", label: "Quizzes", icon: ClipboardCheck },
  { href: "/dashboard/rooms", label: "Salas", icon: Users }
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

  const visibleNavItems = user.role === "admin"
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#ded1af] via-[#afadcf] to-[#dae1fa]">

      <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col border-r border-white/40 backdrop-blur-3xl bg-white/20 shadow-md lg:w-64 ">

        <div className="p-4 md:p-6 ">
          <div className="flex items-center gap-3">
            <span className="rounded-lg p-2 text-slate-900">
              <BookOpen className="h-6 w-6" />
            </span>
            <div className="hidden md:block">
              <p className="text-md font-semibold uppercase tracking-wider text-zinc-00">Study Chat ₊⊹</p>
              <h1 className="m-0 text-xl font-bold text-slate-900">Panel</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6 md:px-4 " aria-label="Navegación principal">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center justify-center gap-3 rounded-lg px-3 py-3 font-medium transition-colors md:justify-start md:px-4 ${
                  isActive
                    ? "bg-slate-100 border border-white/40 backdrop-blur-3xl bg-white/20 shadow-md  "
                    : "text-slate-800 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 md:p-4">
          <div className="mb-3 hidden rounded-lg bg-zinc-800 p-4 md:block bg-white/20 shadow-xl">
            <p className="truncate text-sm font-semibold text-white">{user.email}</p>
            <p className="mt-1 text-xs capitalize text-white">{user.role}</p>
          </div>
          <button
            type="button"
            title="Cerrar sesión"
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-violet-700 md:px-4 bg-white/40 shadow-md"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <section className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</section>
      </main>
    </div>
  );
}
