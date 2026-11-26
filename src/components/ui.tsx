"use client";
import { useId, type ReactNode } from "react";
import type { Eff } from "@/game/types";
import { ALL_SYS, FACTIONS, IDEOLOGIES } from "@/game/data/core";
import { MEMBERS } from "@/game/data/people";
import { ORGS, RIVALS } from "@/game/data/parties";

const LABEL: Record<string, string> = {
  ap: "Рейтинг", pc: "Политкапитал", fd: "Касса", un: "Единство", stb: "Стабильность", ec: "Экономика", lv: "Уровень жизни",
  ml: "Армия", pr: "Престиж", fr: "Свободы", co: "Коррупция", seat: "Места в парламенте",
};

export function effLabel(k: string): string | null {
  if (LABEL[k]) return LABEL[k];
  const [p, id] = [k.slice(0, 2), k.slice(2)];
  if (p === "f.") return `Влияние: ${FACTIONS.find((f) => f.id === id)?.name ?? id}`;
  if (p === "l.") return `Лояльность: ${FACTIONS.find((f) => f.id === id)?.name ?? id}`;
  if (p === "m.") return `Лояльность: ${MEMBERS.find((m) => m.id === id)?.name ?? id}`;
  if (p === "r.") return `Рейтинг: ${RIVALS.find((r) => r.id === id)?.name ?? id}`;
  if (p === "o.") return `Орг.: ${ORGS.find((o) => o.id === id)?.name ?? id}`;
  if (p === "i.") return `Идеология: ${IDEOLOGIES.find((i) => i.id === id)?.name ?? id}`;
  return null;
}

export function EffChips({ e, hide }: { e: Eff; hide?: boolean }) {
  if (hide) return null;
  const chips: ReactNode[] = [];
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === "string") {
      if (ALL_SYS[v]) chips.push(<span key={k} className="rounded bg-violet-900/60 px-1.5 py-0.5 text-[11px] text-violet-200">⇒ {ALL_SYS[v].name}</span>);
      continue;
    }
    if (k.startsWith("flag.") || k.startsWith("unflag.") || k.startsWith("kill.")) continue;
    const lab = effLabel(k);
    if (!lab) continue;
    const good = k === "co" ? v < 0 : v > 0;
    chips.push(
      <span key={k} className={`rounded px-1.5 py-0.5 text-[11px] ${good ? "bg-emerald-900/60 text-emerald-200" : "bg-rose-900/60 text-rose-200"}`}>
        {v > 0 ? "+" : ""}{v} {lab}
      </span>,
    );
  }
  return <div className="mt-1 flex flex-wrap gap-1">{chips}</div>;
}

export function Bar({ v, max = 100, color = "#38bdf8", inv }: { v: number; max?: number; color?: string; inv?: boolean }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  const c = inv ? (pct > 66 ? "#f43f5e" : pct > 40 ? "#f59e0b" : "#22c55e") : color;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-slate-700">
      <div className="h-full rounded" style={{ width: `${pct}%`, background: c }} />
    </div>
  );
}

export function Panel({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-4 shadow">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ children, onClick, disabled, kind = "primary", className = "" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "primary" | "ghost" | "danger" | "good"; className?: string }) {
  const k = {
    primary: "bg-sky-600 hover:bg-sky-500 text-white",
    ghost: "bg-slate-700 hover:bg-slate-600 text-slate-100",
    danger: "bg-rose-700 hover:bg-rose-600 text-white",
    good: "bg-emerald-700 hover:bg-emerald-600 text-white",
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${k} ${className}`}>
      {children}
    </button>
  );
}

/** Original vector portraits used until bespoke art is added. */
export function Portrait({ name, color = "#38bdf8", className = "" }: { name: string; color?: string; className?: string }) {
  const gradientId = `portrait-${useId().replace(/:/g, "")}`;
  let seed = 0;
  for (const char of name) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const skin = ["#f1c9a5", "#d7a987", "#edc4a4", "#bf8f72"][seed % 4];
  const hair = ["#28231f", "#44352c", "#8a735b", "#272b33"][Math.floor(seed / 7) % 4];
  const jacket = ["#1e293b", "#334155", "#0f3b56", "#3b2d45"][Math.floor(seed / 13) % 4];
  return (
    <svg viewBox="0 0 96 112" role="img" aria-label={`Портрет: ${name}`} className={`shrink-0 overflow-hidden rounded-xl border border-white/10 shadow ${className}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1"><stop stopColor={color} stopOpacity=".7" /><stop offset="1" stopColor="#0f172a" /></linearGradient>
      </defs>
      <rect width="96" height="112" fill={`url(#${gradientId})`} />
      <circle cx="76" cy="18" r="28" fill="#fff" opacity=".08" />
      <path d="M7 112c2-25 15-39 41-39s39 14 41 39" fill={jacket} />
      <path d="M38 67h20v16H38z" fill={skin} />
      <path d="m34 78 14 12 14-12 11 10-8 24H31l-8-24z" fill="#e2e8f0" />
      <path d="m43 86 5 6 5-6 5 26H38z" fill={color} />
      <ellipse cx="48" cy="43" rx="22" ry="27" fill={skin} />
      <path d="M26 42c-2-21 7-32 23-32 17 0 24 10 22 31l-5-9c-10 1-21-2-30-8-2 8-5 14-10 18z" fill={hair} />
      <path d="M29 39c-5-5-8-1-6 6 1 5 4 8 8 7M67 39c5-5 8-1 6 6-1 5-4 8-8 7" fill={skin} />
      <path d="M38 43h5m11 0h5" stroke="#312b28" strokeWidth="2" strokeLinecap="round" />
      <path d="M48 45v9" stroke="#9c6b55" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M42 61c4 3 9 3 13 0" fill="none" stroke="#8a4f46" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 34c4-2 9-2 13 0m9 0c4-2 9-2 13 0" fill="none" stroke={hair} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Flag({ flag, label, className = "" }: { flag: string; label: string; className?: string }) {
  return <span role="img" aria-label={`Флаг: ${label}`} title={label} className={`inline-flex items-center justify-center ${className}`}>{flag || "🏳️"}</span>;
}
