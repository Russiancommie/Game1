import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Кремль:2K — Пре-Альфа",
  description: "Политическая стратегия о событиях, фракциях, идеологиях, войнах, дипломатии и выборе курса России.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
