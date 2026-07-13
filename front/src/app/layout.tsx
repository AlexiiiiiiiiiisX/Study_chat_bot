import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Study Chat Bot",
  description: "Frontend de estudio con chat, documentos, flashcards, quizzes y administración."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="font-sans">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
