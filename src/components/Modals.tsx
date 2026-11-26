"use client";
import { useState } from "react";
import type { GameState } from "@/game/types";
import { CONGRESSES, ELECTIONS, FACTIONS, IDEOLOGIES, SUBS, MONTHS } from "@/game/data/core";
import {
  DIFF_BY_ID, EV_BY_ID, STRATS, adoptSub, closeCongress, congressThreshold, electionCandidates, eventOptions, fmt, lobbyCost, resolveEvent, runElection, subSupport,
} from "@/game/engine";
import type { ElectionReport } from "@/game/engine";
import { Bar, Btn, EffChips } from "./ui";

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-600 bg-slate-800 p-5 shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}>{children}</div>
    </div>
  );
}

export function EventModal({ s, set }: { s: GameState; set: (n: GameState) => void }) {
  const id = s.queue[0];
  const ev = EV_BY_ID[id];
  if (!ev) return null;
  const hide = DIFF_BY_ID[s.diff].hide;
  const opts = eventOptions(ev);
  return (
    <Shell>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span className={`rounded px-2 py-0.5 ${ev.hist ? "bg-amber-900 text-amber-200" : "bg-slate-700"}`}>{ev.hist ? "📜 Историческое событие" : ev.cat}</span>
        <span>Событий в очереди: {s.queue.length}</span>
      </div>
      <h2 className="text-xl font-bold text-white">{fmt(ev.title, s)}</h2>
      <p className="mt-2 text-slate-200">{fmt(ev.text, s)}</p>
      <div className="mt-4 space-y-2">
        {opts.map((o, i) => (
          <button key={i} disabled={!!o.c && s.st.pc < o.c} onClick={() => resolveEvent(s, id, i) !== s && set(resolveEvent(s, id, i))} className="w-full rounded-lg border border-slate-600 bg-slate-900/70 p-3 text-left transition hover:border-sky-500 hover:bg-slate-700 disabled:opacity-40">
            <div className="font-medium">{o.t}{o.c ? ` (−${o.c} ПК)` : ""}</div>
            {o.r && <div className="text-xs text-slate-400">{o.r}</div>}
            <EffChips e={o.e} hide={hide} />
          </button>
        ))}
      </div>
    </Shell>
  );
}

export function ElectionModal({ s, set, report, setReport }: { s: GameState; set: (n: GameState) => void; report: ElectionReport | null; setReport: (r: ElectionReport | null) => void }) {
  const el = ELECTIONS.find((e) => e.id === s.pending?.id);
  const [cand, setCand] = useState("");
  const [strat, setStrat] = useState("std");
  if (report) {
    return (
      <Shell>
        <h2 className="text-xl font-bold">{report.title}: {report.win ? "успех" : "провал"}</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-200">{report.lines.map((l, i) => <li key={i}>• {l}</li>)}</ul>
        <div className="mt-3 space-y-1">
          {report.table.map((t, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm"><span className={t.us ? "font-bold text-sky-300" : t.pass ? "" : "text-slate-500"}>{t.name}{!t.pass ? " (не прошла барьер)" : ""}</span><span>{t.share.toFixed(1)}%</span></div>
              <Bar v={t.share} color={t.us ? "#38bdf8" : "#64748b"} />
            </div>
          ))}
        </div>
        <div className="mt-4 text-right"><Btn onClick={() => setReport(null)}>Продолжить</Btn></div>
      </Shell>
    );
  }
  if (!el) return null;
  const list = electionCandidates(s, el.type);
  const strats = STRATS;
  return (
    <Shell wide>
      <h2 className="text-xl font-bold">{el.title}</h2>
      <p className="text-sm text-slate-400">{el.type === "pres" ? "Выберите кандидата партии власти" : "Выберите лидера избирательного списка"} и стиль кампании. Реальная поддержка зависит от рейтинга и кандидата, а административный ресурс повышает официальный результат — но ведёт к риску протестов.</p>
      <h3 className="mt-3 text-sm font-semibold uppercase text-slate-300">Кандидат</h3>
      <div className="mt-1 grid gap-2 md:grid-cols-3">
        {list.map(({ c, ok, why }) => (
          <button key={c.id} disabled={!ok} onClick={() => setCand(c.id)} className={`rounded-lg border p-2 text-left text-sm ${cand === c.id ? "border-sky-500 bg-slate-700" : "border-slate-700 bg-slate-900/60"} disabled:opacity-40`}>
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-slate-400">{c.bio}</div>
            <div className="mt-1 text-[11px] text-slate-300">Харизма {c.ch} • Элиты {c.el}</div>
            {!ok && <div className="text-[11px] text-rose-400">{why}</div>}
            {ok && !DIFF_BY_ID[s.diff].hide && <EffChips e={c.e} />}
          </button>
        ))}
      </div>
      <h3 className="mt-4 text-sm font-semibold uppercase text-slate-300">Стиль кампании (касса: {Math.round(s.st.fd)} млн)</h3>
      <div className="mt-1 grid gap-2 md:grid-cols-2">
        {strats.map((st) => (
          <button key={st.id} onClick={() => setStrat(st.id)} className={`rounded-lg border p-2 text-left text-sm ${strat === st.id ? "border-sky-500 bg-slate-700" : "border-slate-700 bg-slate-900/60"}`}>
            <div className="font-medium">{st.name} <span className="text-xs text-slate-400">({st.cost} млн)</span></div>
            <div className="text-xs text-slate-400">{st.desc}</div>
            {s.st.fd < st.cost && <div className="text-[11px] text-amber-400">Денег не хватит — кампания будет урезана</div>}
          </button>
        ))}
      </div>
      <div className="mt-4 text-right">
        <Btn disabled={!cand} onClick={() => { const r = runElection(s, el.id, cand, strat); set(r.s); setReport(r.report); }}>Провести выборы</Btn>
      </div>
    </Shell>
  );
}

export function CongressModal({ s, set, notify }: { s: GameState; set: (n: GameState) => void; notify: (t: string, lines: string[]) => void }) {
  const cg = CONGRESSES.find((c) => `${c.y}-${c.m}` === s.pending?.id);
  const [open, setOpen] = useState(s.mainIde);
  const [pick, setPick] = useState(s.sub);
  const [boost, setBoost] = useState(0);
  const [steps, setSteps] = useState(0);
  const thr = congressThreshold(s);
  const sup = subSupport(s, pick, boost);
  return (
    <Shell wide>
      <h2 className="text-xl font-bold">🏛️ {cg ? `${cg.title} — ${MONTHS[cg.m - 1]} ${cg.y}` : "Внеочередной съезд партии"}</h2>
      <p className="text-sm text-slate-400">Съезд — единственный момент, когда партия может сменить идеологию. Выберите субидеологию, при необходимости проведите лоббирование и вынесите на голосование. Нужно набрать минимум {thr}%.</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {IDEOLOGIES.map((i) => (
          <button key={i.id} onClick={() => setOpen(i.id)} className={`rounded px-2 py-1 text-xs ${open === i.id ? "bg-sky-700" : "bg-slate-700"}`} style={{ borderBottom: `2px solid ${i.color}` }}>{i.name}</button>
        ))}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {SUBS.filter((x) => x.ide === open).map((sub) => {
          const v = subSupport(s, sub.id);
          return (
            <button key={sub.id} onClick={() => { setPick(sub.id); setBoost(0); setSteps(0); }} className={`rounded-lg border p-2 text-left text-sm ${pick === sub.id ? "border-sky-500 bg-slate-700" : "border-slate-700 bg-slate-900/60"}`}>
              <div className="flex justify-between"><span>{sub.name}{s.sub === sub.id ? " (текущая)" : ""}</span><b>{Math.round(v)}%</b></div>
              <Bar v={v} color={v >= thr ? "#22c55e" : "#f59e0b"} />
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-slate-900/70 p-3">
        <div className="text-sm">Выбрано: <b>{SUBS.find((x) => x.id === pick)?.name}</b> — поддержка с лоббированием: <b className={sup >= thr ? "text-emerald-400" : "text-amber-400"}>{Math.round(sup)}%</b> (порог {thr}%)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn kind="ghost" disabled={s.st.pc < lobbyCost(steps) || steps >= 4} onClick={() => { const n = structuredClone(s); n.st.pc -= lobbyCost(steps); set(n); setBoost(boost + 7); setSteps(steps + 1); }}>
            Лоббировать (−{lobbyCost(steps)} ПК, +7%)
          </Btn>
          <Btn disabled={pick === s.sub} onClick={() => {
            const r = adoptSub(s, pick, boost);
            set(r.s);
            const sub = SUBS.find((x) => x.id === pick)!;
            notify(r.ok ? "Съезд принял новую идеологию" : "Съезд отверг предложение", [`«${sub.name}»: ${Math.round(r.support)}% голосов делегатов (порог ${thr}%).`, r.ok ? "Фракции пересчитывают лояльность в зависимости от вашего выбора." : "Единство партии пострадало, политкапитал потерян."]);
          }}>Вынести на голосование</Btn>
          <Btn kind="ghost" onClick={() => set(closeCongress(s))}>Оставить курс без изменений</Btn>
        </div>
        <div className="mt-2 text-xs text-slate-500">Фракции: {FACTIONS.map((f) => `${f.name} ${Math.round(s.fac[f.id])}/${Math.round(s.facLoy[f.id])}`).join(" • ")}</div>
      </div>
    </Shell>
  );
}

export function Notice({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  return (
    <Shell>
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className="mt-2 space-y-1 text-slate-200">{lines.map((l, i) => <li key={i}>• {l}</li>)}</ul>
      <div className="mt-4 text-right"><Btn onClick={onClose}>Ок</Btn></div>
    </Shell>
  );
}
