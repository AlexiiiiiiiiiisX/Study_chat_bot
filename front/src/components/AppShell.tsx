"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth"

const navItems = [
  { href: "/dashboard", label: "Inicio y Documentos" },
  { href: "/dashboard/chat", label: "Chat RAG" },
  { href: "/dashboard/flashcards", label: "Flashcards" },
  { href: "/dashboard/quizzes", label: "Quizzes" },
  { href: "/admin", label: "Admin" }
]

export function AppShell({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
    if (!loading && requireAdmin && user && user.role !== "admin") router.replace("/dashboard")
  }, [loading, requireAdmin, router, user])

  if (loading) {
    return (
      <main className="center-page">
        <div className="loader" />
        <p>Validando sesion...</p>
      </main>
    )
  }

  if (!user || (requireAdmin && user.role !== "admin")) return null

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Estudia AI</p>
          <h1>Panel</h1>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="user-box">
          <strong>{user.email}</strong>
          <span>{user.role}</span>
          <button className="ghost-button" type="button" onClick={() => void logout().then(() => router.replace("/login"))}>
            Cerrar sesion
          </button>
        </div>
      </aside>
      <section className="content-area">{children}</section>
    </main>
  )
}