"use client";
import { useMemo, useState } from "react";
import type { FocusNode, GameState, TreeId } from "@/game/types";
import { ALL_SYS, CONGRESSES, DIFFS, ECONOMIES, FACTIONS, IDEOLOGIES, MONTHS, PARLIAMENTS, STATES, STATS, SUBS, SUB_BY_ID } from "@/game/data/core";
import { ORGS, RIVALS } from "@/game/data/parties";
import { FOCUS, FOCUS_BY_ID, TREES } from "@/game/data/focus";
import { BILLS, BUDGETS, MINISTRIES, primeMinister } from "@/game/data/gov";
import {
  DIFF_BY_ID, billSupport, callExtraCongress, cancelFocus, facShares, fmt, focusStatus, ideShares, leaderOf, memberActive, membersFor, orgAction, orgInfo, passBill,
  reassignMinistry, rivalAction, setBudget, startFocus, subSupport, useMember as memberDecision, applyEff, congressThreshold,
} from "@/game/engine";
import { Bar, Btn, EffChips, Panel, Portrait } from "./ui";

interface P { s: GameState; set: (n: GameState) => void }
const hideOf = (s: GameState) => DIFF_BY_ID[s.diff].hide;

const DUMA_COLORS: Record<string, string> = { parl: "#0ea5e9", lib: "#3b82f6", left: "#ef4444", nat: "#f59e0b", other: "#a855f7" };
function dumaSeatRows(s: GameState) {
  const active = RIVALS.filter((rival) => s.riv[rival.id]?.alive).sort((a, b) => (s.riv[b.id]?.r ?? 0) - (s.riv[a.id]?.r ?? 0));
  const strength = active.reduce((sum, rival) => sum + Math.max(0, s.riv[rival.id]?.r ?? 0), 0);
  const opposition = Math.max(0, 100 - s.seats);
  return [
    { name: s.partyName, share: s.seats, color: "#dc2626" },
    ...active.map((rival) => ({ name: rival.name, share: strength ? opposition * Math.max(0, s.riv[rival.id]?.r ?? 0) / strength : 0, color: DUMA_COLORS[rival.kind] ?? "#64748b" })),
    ...(active.length ? [] : [{ name: "Прочие партии", share: opposition, color: "#64748b" }]),
  ];
}

function DumaSeats({ s }: { s: GameState }) {
  const rows = dumaSeatRows(s);
  return (
    <Panel title="Места в Государственной думе · 450 мандатов">
      <div role="img" aria-label={`Распределение мест: ${s.partyName} — ${Math.round(s.seats)} процентов`} className="flex h-7 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        {rows.filter((row) => row.share > 0.15).map((row) => <div key={row.name} title={`${row.name}: ${Math.round(row.share)}%`} style={{ width: `${row.share}%`, backgroundColor: row.color }} />)}
      </div>
      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.name} className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 truncate"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />{row.name}</span>
              <b className="shrink-0 text-slate-200">{Math.round(row.share * 4.5)} м. · {row.share.toFixed(1)}%</b>
            </div>
            <div className="mt-1"><Bar v={row.share} color={row.color} /></div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Оценка мест строится из текущей доли партии и рейтингов соперников; после выборов распределение пересчитывается.</p>
    </Panel>
  );
}

// ═══════ ОБЗОР ═══════
export function Overview({ s }: { s: GameState }) {
  const pts = s.hist.slice(-120);
  const w = 520, h = 110;
  const line = (key: "ap" | "ec") => pts.map((p, i) => `${(i / Math.max(1, pts.length - 1)) * w},${h - (p[key] / 100) * h}`).join(" ");
  const sub = SUB_BY_ID[s.sub];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Показатели">
        <div className="space-y-2.5">
          {STATS.map((st) => {
            const v = s.st[st.k];
            return (
              <div key={st.k}>
                <div className="flex justify-between text-sm"><span>{st.icon} {st.n}</span><b>{st.k === "fd" ? `${Math.round(v)} млн` : Math.round(v)}</b></div>
                <Bar v={v} max={st.k === "fd" ? 500 : 100} inv={st.inv} />
              </div>
            );
          })}
          <div className="text-sm text-slate-300">🛢️ Нефть: <b>{s.oil.toFixed(0)} $</b></div>
        </div>
      </Panel>
      <Panel title="Власть и строй">
        <dl className="space-y-1.5 text-sm">
          <div><dt className="text-slate-400">Президент</dt><dd>{fmt("{PRES}", s)}</dd></div>
          <div><dt className="text-slate-400">Премьер-министр</dt><dd>{primeMinister(s.year, s.month)}</dd></div>
          <div><dt className="text-slate-400">Председатель партии</dt><dd>{s.chair === "gryzlov" ? "Борис Грызлов" : s.chair === "putin" ? "Владимир Путин" : "Дмитрий Медведев"}</dd></div>
          <div><dt className="text-slate-400">Экономика</dt><dd>{ALL_SYS[s.eco].name}</dd></div>
          <div><dt className="text-slate-400">Госустройство</dt><dd>{ALL_SYS[s.gov].name}</dd></div>
          <div><dt className="text-slate-400">Парламент</dt><dd>{ALL_SYS[s.par].name}</dd></div>
          <div><dt className="text-slate-400">Идеология партии</dt><dd>{IDEOLOGIES.find((i) => i.id === s.mainIde)?.name} → <b>{sub?.name}</b></dd></div>
          <div><dt className="text-slate-400">Мандатов в Думе</dt><dd>{Math.round(s.seats)}%</dd></div>
          <div><dt className="text-slate-400">Сложность</dt><dd>{DIFFS.find((d) => d.id === s.diff)?.name}</dd></div>
        </dl>
      </Panel>
      <Panel title="Динамика рейтинга и экономики">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded bg-slate-900/70">
          {pts.length > 1 && <polyline fill="none" stroke="#38bdf8" strokeWidth="2" points={line("ap")} />}
          {pts.length > 1 && <polyline fill="none" stroke="#f59e0b" strokeWidth="2" points={line("ec")} />}
        </svg>
        <div className="mt-1 flex gap-4 text-xs text-slate-400"><span className="text-sky-400">— рейтинг</span><span className="text-amber-400">— экономика</span></div>
        <h4 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-400">Последнее в журнале</h4>
        <ul className="space-y-1 text-xs text-slate-300">{s.log.slice(0, 7).map((l, i) => <li key={i}>• {l}</li>)}</ul>
      </Panel>
      <div className="lg:col-span-3"><DumaSeats s={s} /></div>
    </div>
  );
}

// ═══════ ПАРТИЙЦЫ ═══════
export function Members({ s, set }: P) {
  const [only, setOnly] = useState(true);
  const list = membersFor(s).filter((m) => !only || memberActive(s, m.id));
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> только активные в {s.year} г.</label>
        <span className="text-slate-400">Решение партийца действует сильнее при высокой лояльности. После использования — перезарядка.</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const ms = s.mem[m.id] ?? { loy: m.loy, cd: 0, used: 0 };
          const act = memberActive(s, m.id);
          const fac = FACTIONS.find((f) => f.id === m.fac)!;
          const sympathy = FACTIONS.find((f) => f.id === m.positions.sympathy)?.name ?? m.positions.sympathy;
          const can = act && ms.cd === 0 && ms.loy >= 20 && s.st.pc >= m.pc;
          return (
            <div key={m.id} className={`rounded-xl border border-slate-700 bg-slate-800/70 p-3 ${act ? "" : "opacity-50"}`}>
              <div className="flex items-start gap-3">
                <Portrait name={m.name} color={fac.color} className="h-24 w-[4.5rem]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-semibold text-white">{m.name}</div><div className="text-xs text-slate-400">{m.role}</div></div>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: fac.color }}>{fac.name}</span>
                  </div>
                  {m.custom && <div className="mt-1 inline-flex rounded bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-200">Создан вами · игрок</div>}
                  <div className="mt-2 text-xs text-slate-400">Лояльность: {Math.round(ms.loy)} • Использовано: {ms.used} • {m.from}–{m.to === 2026 ? "н.в." : m.to}</div>
                </div>
              </div>
              <Bar v={ms.loy} color={fac.color} />
              <div className="mt-2 rounded-lg border border-slate-700/70 bg-slate-900/60 p-2.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300">Позиции партийца</div>
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  <div><span className="text-slate-500">Характер:</span> {m.positions.character}</div>
                  <div><span className="text-slate-500">Экономика:</span> {m.positions.economy}</div>
                  <div className="sm:col-span-2"><span className="text-slate-500">Сочувствует фракции:</span> <b style={{ color: fac.color }}>{sympathy}</b></div>
                </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">{m.positions.traits.map((trait) => <span key={trait} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{trait}</span>)}</div>
              </div>
              <div className="mt-2 rounded bg-slate-900/60 p-2">
                <div className="text-sm font-medium">{m.dec}</div>
                <div className="text-xs text-slate-400">{fmt(m.decText, s)}</div>
                <EffChips e={m.e} hide={hideOf(s)} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Цена: {m.pc} ПК {ms.cd > 0 ? `• перезарядка ${ms.cd} мес.` : ""}</span>
                  <Btn disabled={!can} onClick={() => set(memberDecision(s, m.id))}>Применить</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════ ФРАКЦИИ ═══════
export function Factions({ s, set }: P) {
  const rows = facShares(s);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ f, share, loy, leader }) => {
        const ppl = membersFor(s).filter((m) => m.fac === f.id && memberActive(s, m.id));
        return (
          <div key={f.id} className="rounded-xl border border-slate-700 bg-slate-800/70 p-3" style={{ borderLeft: `4px solid ${f.color}` }}>
            <div className="flex justify-between"><b>{f.name}</b><span className="text-sm text-slate-300">{share.toFixed(1)}%</span></div>
            <div className="text-xs text-slate-400">Лидер: <span className="text-slate-200">{leader}</span> • идеология: {IDEOLOGIES.find((i) => i.id === f.ide)?.name}</div>
            <p className="my-2 text-xs text-slate-300">{f.desc}</p>
            <div className="text-xs text-slate-400">Влияние</div><Bar v={share} max={40} color={f.color} />
            <div className="mt-1 text-xs text-slate-400">Лояльность руководству: {Math.round(loy)}</div><Bar v={loy} color="#22c55e" />
            <div className="mt-2 text-xs text-slate-400">Партийцы: {ppl.map((p) => p.name.split(" ").slice(-1)[0]).join(", ") || "—"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn kind="ghost" disabled={s.st.pc < 6} onClick={() => { const n = structuredClone(s); n.st.pc -= 6; applyEff(n, { [`l.${f.id}`]: 7 }); set(n); }}>Задобрить (−6 ПК)</Btn>
              <Btn kind="ghost" disabled={s.st.fd < 40} onClick={() => { const n = structuredClone(s); n.st.fd -= 40; applyEff(n, { [`f.${f.id}`]: 2, [`l.${f.id}`]: 3 }); set(n); }}>Финансы (−40)</Btn>
              <Btn kind="ghost" disabled={s.st.pc < 4 || s.facLoy[f.id] > 85} onClick={() => { const n = structuredClone(s); n.st.pc -= 4; applyEff(n, { [`f.${f.id}`]: -2, [`l.${f.id}`]: -3, un: 1 }); set(n); }}>Ослабить</Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════ ИДЕОЛОГИЯ ═══════
export function Ideology({ s, set }: P) {
  const shares = ideShares(s);
  const [open, setOpen] = useState<string>(s.mainIde);
  const [partyDraft, setPartyDraft] = useState(s.partyName);
  const next = CONGRESSES.find((c) => c.y * 12 + c.m >= s.year * 12 + s.month);
  return (
    <div className="space-y-4">
      <Panel title="Идеологический спектр партии" right={<Btn disabled={s.st.pc < 25 || !!s.pending} onClick={() => set(callExtraCongress(s))}>Внеочередной съезд (25 ПК)</Btn>}>
        <div className="grid gap-2 md:grid-cols-3">
          {shares.map(({ i, w }) => (
            <button key={i.id} onClick={() => setOpen(i.id)} className={`rounded-lg border p-2 text-left ${open === i.id ? "border-sky-500 bg-slate-700" : "border-slate-700 bg-slate-900/50"}`}>
              <div className="flex justify-between text-sm"><span style={{ color: i.color }}>{i.name}{s.mainIde === i.id ? " ★" : ""}</span><b>{w.toFixed(1)}%</b></div>
              <Bar v={w} max={50} color={i.color} />
              <div className="mt-1 text-[11px] text-slate-400">{i.desc}</div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Идеологию партии (субидеологию) можно сменить только на съезде: нужно набрать {congressThreshold(s)}% поддержки фракций. Следующий съезд: {next ? `${MONTHS[next.m - 1]} ${next.y} — ${next.title}` : "—"}.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <label className="min-w-[220px] flex-1 text-xs text-slate-400">Название партии или движения после смены курса
            <input value={partyDraft} onChange={(event) => setPartyDraft(event.target.value)} maxLength={48} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500" />
          </label>
          <Btn disabled={!partyDraft.trim() || partyDraft.trim() === s.partyName} onClick={() => {
            const n = structuredClone(s);
            n.partyName = partyDraft.trim().slice(0, 48);
            n.log.unshift(`${MONTHS[n.month - 1]} ${n.year}: движение переименовано в «${n.partyName}».`);
            set(n);
          }}>Сохранить название</Btn>
          <span className="w-full text-[11px] text-slate-500">По умолчанию — «Единая Россия». Новое название отображается в интерфейсе и графике мест в Госдуме.</span>
        </div>
      </Panel>
      <Panel title={`Субидеологии: ${IDEOLOGIES.find((i) => i.id === open)?.name}`}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {SUBS.filter((x) => x.ide === open).map((sub) => {
            const sup = subSupport(s, sub.id);
            return (
              <div key={sub.id} className={`rounded-lg border p-2 ${s.sub === sub.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700 bg-slate-900/50"}`}>
                <div className="flex justify-between text-sm font-medium"><span>{sub.name}{s.sub === sub.id ? " ✔" : ""}</span><span className="text-slate-300">{Math.round(sup)}%</span></div>
                <Bar v={sup} color={sup >= congressThreshold(s) ? "#22c55e" : "#f59e0b"} />
                <div className="mt-1 text-[11px] text-slate-400">Поддерживают: {sub.fav.map((f) => FACTIONS.find((x) => x.id === f)?.name).join(", ")}</div>
                <EffChips e={Object.fromEntries(Object.entries(sub.e).map(([k, v]) => [k, Math.round((v as number) * 12 * 10) / 10]))} hide={hideOf(s)} />
                <div className="text-[10px] text-slate-500">эффекты показаны за год</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ═══════ ДЕРЕВО РЕШЕНИЙ ═══════
const depthCache: Record<string, number> = {};
function depth(n: FocusNode): number {
  if (depthCache[n.id] !== undefined) return depthCache[n.id];
  const deps = [...n.pre, ...(n.any ?? [])].map((x) => FOCUS_BY_ID[x]).filter(Boolean);
  const d = deps.length ? 1 + Math.max(...deps.map(depth)) : 0;
  depthCache[n.id] = d;
  return d;
}
const ST_STYLE: Record<string, string> = {
  done: "border-emerald-500 bg-emerald-950/60 text-emerald-200",
  active: "border-sky-400 bg-sky-950/70 text-sky-100 animate-pulse",
  available: "border-amber-400 bg-slate-800 text-slate-100 hover:bg-slate-700",
  locked: "border-slate-700 bg-slate-900/60 text-slate-500",
  blocked: "border-rose-900 bg-rose-950/30 text-rose-300/60 line-through",
  future: "border-slate-700 bg-slate-900/60 text-slate-500 italic",
};

export function FocusTrees({ s, set }: P) {
  const [tree, setTree] = useState<TreeId>("eco");
  const [sel, setSel] = useState<string | null>(null);
  const nodes = useMemo(() => FOCUS.filter((n) => n.tree === tree), [tree]);
  const cols = useMemo(() => {
    const m: FocusNode[][] = [];
    for (const n of nodes) (m[depth(n)] ??= []).push(n);
    return m;
  }, [nodes]);
  const node = sel ? FOCUS_BY_ID[sel] : null;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        {TREES.map((t) => {
          const ft = s.focus[t.id];
          return (
            <button key={t.id} onClick={() => setTree(t.id)} className={`rounded-lg border p-2 text-left text-sm ${tree === t.id ? "border-sky-500 bg-slate-700" : "border-slate-700 bg-slate-800/70"}`}>
              <div className="font-semibold">{t.icon} {t.name}</div>
              <div className="text-xs text-slate-400">Выполнено: {ft.done.length}/{FOCUS.filter((n) => n.tree === t.id).length}</div>
              <div className="text-xs text-sky-300">{ft.cur ? `${FOCUS_BY_ID[ft.cur].name} — ещё ${ft.left} мес.` : "свободно"}</div>
            </button>
          );
        })}
      </div>
      {node && (
        <Panel title={node.name} right={<Btn kind="ghost" onClick={() => setSel(null)}>Закрыть</Btn>}>
          <p className="text-sm text-slate-300">{node.desc} {node.crazy && <span className="rounded bg-fuchsia-900 px-1.5 text-xs">шизопуть</span>}</p>
          <EffChips e={node.e} hide={hideOf(s)} />
          <div className="mt-2 text-xs text-slate-400">
            Срок: {node.cost} мес. • Цена: {node.pc} ПК
            {node.pre.length > 0 && <> • Требуется: {node.pre.map((p) => FOCUS_BY_ID[p]?.name).join(", ")}</>}
            {node.any && <> • Любое из: {node.any.map((p) => FOCUS_BY_ID[p]?.name).join(", ")}</>}
            {node.excl && <> • Исключает: {node.excl.map((p) => FOCUS_BY_ID[p]?.name).join(", ")}</>}
            {node.y && <> • С {node.y} г.</>}
          </div>
          <div className="mt-2 flex gap-2">
            <Btn disabled={focusStatus(s, node) !== "available" || !!s.focus[node.tree].cur || s.st.pc < node.pc} onClick={() => set(startFocus(s, node.id))}>Начать ({focusStatus(s, node)})</Btn>
            {s.focus[node.tree].cur === node.id && <Btn kind="danger" onClick={() => set(cancelFocus(s, node.tree))}>Отменить</Btn>}
          </div>
        </Panel>
      )}
      <div className="overflow-x-auto pb-3">
        <div className="mx-auto flex min-w-[560px] flex-col items-center">
          {cols.map((col, ci) => (
            <div key={ci} className="w-full">
              {ci > 0 && <div aria-hidden="true" className="my-1 flex justify-center text-2xl font-light leading-none text-sky-600">↓</div>}
              <div className="mb-2 text-center text-[10px] uppercase tracking-[.2em] text-slate-500">Уровень {ci + 1}</div>
              <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2">
                {col.map((n) => {
                  const st = focusStatus(s, n);
                  return (
                    <button key={n.id} onClick={() => setSel(n.id)} className={`w-44 rounded-lg border p-2 text-left text-xs transition ${ST_STYLE[st]} ${sel === n.id ? "ring-2 ring-sky-400" : ""}`}>
                      <div className="font-medium leading-tight">{n.crazy ? "🤪 " : ""}{n.name}</div>
                      <div className="mt-1 text-[10px] opacity-70">{n.cost} мес. • {n.pc} ПК</div>
                    </button>
                  );
                })}
              </div>
              {ci < cols.length - 1 && <div className="mx-auto mt-3 h-4 w-px bg-gradient-to-b from-sky-500/70 to-transparent" />}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span className="text-emerald-300">■ выполнено</span><span className="text-sky-300">■ в процессе</span><span className="text-amber-300">■ доступно</span><span>■ закрыто</span><span className="text-rose-300">■ исключено</span><span>🤪 шизопуть</span>
      </div>
    </div>
  );
}

// ═══════ ПРАВИТЕЛЬСТВО ═══════
export function Government({ s, set }: P) {
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Кабинет министров">
        <div className="mb-2 text-sm text-slate-300">Премьер: <b>{primeMinister(s.year, s.month)}</b> • Президент: <b>{fmt("{PRES}", s)}</b></div>
        <div className="space-y-2">
          {MINISTRIES.map((m) => {
            const fac = FACTIONS.find((f) => f.id === s.cabinet[m.id])!;
            const fit = m.fit.includes(fac.id);
            return (
              <div key={m.id} className="rounded bg-slate-900/60 p-2 text-sm">
                <div className="flex justify-between"><span>{m.name}</span><span className={fit ? "text-emerald-400" : "text-amber-400"}>{fit ? "профильная" : "не профиль"}</span></div>
                <select className="mt-1 w-full rounded bg-slate-700 p-1 text-xs" value={fac.id} onChange={(e) => set(reassignMinistry(s, m.id, e.target.value))} disabled={s.st.pc < 8}>
                  {FACTIONS.map((f) => <option key={f.id} value={f.id}>{f.name} — {leaderOf(f.id, s.year)}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Передача ведомства стоит 8 ПК, усиливает фракцию и влияет на показатель ведомства.</p>
      </Panel>
      <Panel title="Бюджетный курс">
        <div className="space-y-2">
          {BUDGETS.map((b) => (
            <button key={b.id} disabled={s.st.pc < 3 && s.budget !== b.id} onClick={() => set(setBudget(s, b.id))} className={`w-full rounded border p-2 text-left text-sm ${s.budget === b.id ? "border-sky-500 bg-slate-700" : "border-slate-700 bg-slate-900/50"}`}>
              <div className="font-medium">{b.name}{s.budget === b.id ? " ✔" : ""}</div>
              <div className="text-xs text-slate-400">{b.desc}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Смена курса — 3 ПК, эффект применяется ежемесячно.</p>
      </Panel>
      <Panel title="Законопроекты в повестке">
        {msg && <div className="mb-2 rounded bg-slate-900 p-2 text-xs text-amber-200">{msg}</div>}
        {s.billOffer.length === 0 && <div className="text-sm text-slate-400">Повестка пуста.</div>}
        <div className="space-y-2">
          {s.billOffer.map((id) => {
            const b = BILLS.find((x) => x.id === id)!;
            const { support, need } = billSupport(s, id);
            return (
              <div key={id} className="rounded bg-slate-900/60 p-2">
                <div className="text-sm font-medium">{b.title}{b.cons ? " ⚖️" : ""}</div>
                <div className="text-xs text-slate-400">{b.desc}</div>
                <EffChips e={b.e} hide={hideOf(s)} />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Ожидаемая поддержка: {Math.round(support)}% (нужно {need.toFixed(0)}%)</span>
                  <Btn disabled={s.st.pc < 3} onClick={() => { const r = passBill(s, id); setMsg(r.ok ? `Принят: ${b.title} (${Math.round(r.support)}%)` : `Провален: ${b.title} (${Math.round(r.support)}%)`); set(r.s); }}>Внести (3 ПК)</Btn>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-400">Принято законов: {s.passed.length}</div>
      </Panel>
    </div>
  );
}

// ═══════ СИСТЕМА ═══════
export function Systems({ s }: { s: GameState }) {
  const block = (title: string, items: typeof ECONOMIES, cur: string) => (
    <Panel title={title}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className={`rounded-lg border p-2 ${cur === it.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700 bg-slate-900/50"}`}>
            <div className="text-sm font-medium">{it.name}{cur === it.id ? " ✔" : ""}</div>
            <div className="text-xs text-slate-400">{it.desc}</div>
            <EffChips e={Object.fromEntries(Object.entries(it.e).map(([k, v]) => [k, Math.round((v as number) * 12 * 10) / 10]))} hide={hideOf(s)} />
            {(it.thr !== undefined) && <div className="text-[11px] text-slate-500">барьер {it.thr}% • бонус мест {it.bonus}% • голосование {it.mod! >= 0 ? "+" : ""}{it.mod}</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Системы меняются через ветки деревьев решений и события. Эффекты показаны за год.</p>
      {block("10 типов экономики", ECONOMIES, s.eco)}
      {block("15 типов госустройства", STATES, s.gov)}
      {block("9 типов парламента", PARLIAMENTS, s.par)}
    </div>
  );
}

// ═══════ ОППОНЕНТЫ ═══════
const ST_RU: Record<string, string> = { active: "действует", dissolved: "распущена", banned: "запрещена", coopted: "кооптирована", pending: "ещё не создана" };
export function Opponents({ s, set }: P) {
  const activeOrgs = Object.entries(s.org).filter(([, o]) => o.status === "active" || o.status === "coopted");
  const goneOrgs = Object.entries(s.org).filter(([, o]) => o.status === "dissolved" || o.status === "banned");
  const alive = RIVALS.filter((r) => s.riv[r.id].alive);
  const total = alive.reduce((a, r) => a + s.riv[r.id].r, 0);
  return (
    <div className="space-y-4">
      <Panel title={`Партии-соперники (${alive.length} действуют)`}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {RIVALS.map((r) => {
            const rs = s.riv[r.id];
            if (rs.r < 0 && !rs.alive) return null;
            return (
              <div key={r.id} className={`rounded-lg border border-slate-700 bg-slate-900/50 p-2 ${rs.alive ? "" : "opacity-50"}`}>
                <div className="flex justify-between text-sm"><b>{r.name}</b><span>{rs.alive ? `${rs.r.toFixed(1)}%` : rs.note ?? "распущена"}</span></div>
                <div className="text-[11px] text-slate-400">{r.leader} • {IDEOLOGIES.find((i) => i.id === r.ide)?.name ?? r.ide}</div>
                {rs.alive && <Bar v={rs.r} max={25} color="#f43f5e" />}
                {rs.alive && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Btn kind="ghost" disabled={s.st.pc < 3} onClick={() => set(rivalAction(s, r.id, "boost"))}>Эфир</Btn>
                    <Btn kind="ghost" disabled={s.st.pc < 3} onClick={() => set(rivalAction(s, r.id, "crush"))}>Давить</Btn>
                    <Btn kind="danger" disabled={s.st.pc < 10} onClick={() => set(rivalAction(s, r.id, "ban"))}>Запретить</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-slate-400">Суммарный рейтинг соперников: {total.toFixed(1)}%</div>
      </Panel>
      <Panel title={`Организации и движения (${activeOrgs.length} действуют, ${goneOrgs.length} распущены/запрещены)`}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activeOrgs.map(([id, o]) => {
            const info = orgInfo(s, id);
            return (
              <div key={id} className="rounded-lg border border-slate-700 bg-slate-900/50 p-2">
                <div className="flex justify-between text-sm"><b>{info.name}</b><span className="text-xs text-slate-300">{o.p.toFixed(0)}</span></div>
                <div className="text-[11px] text-slate-400">{info.leader} • {ST_RU[o.status]}</div>
                <Bar v={o.p} max={40} color={o.status === "coopted" ? "#22c55e" : "#a78bfa"} />
                <div className="mt-2 flex flex-wrap gap-1">
                  <Btn kind="ghost" disabled={s.st.pc < 4 || o.status === "coopted"} onClick={() => set(orgAction(s, id, "coopt"))}>Кооптировать</Btn>
                  <Btn kind="ghost" disabled={s.st.fd < 30} onClick={() => set(orgAction(s, id, "fund"))}>Финансировать</Btn>
                  <Btn kind="ghost" disabled={s.st.pc < 2} onClick={() => set(orgAction(s, id, "pressure"))}>Давление</Btn>
                  <Btn kind="danger" disabled={s.st.pc < 6} onClick={() => set(orgAction(s, id, "ban"))}>Запретить</Btn>
                </div>
              </div>
            );
          })}
        </div>
        {goneOrgs.length > 0 && (
          <div className="mt-3 text-xs text-slate-500">
            <b>Ушли из истории:</b> {goneOrgs.map(([id, o]) => `${orgInfo(s, id).name} (${ST_RU[o.status]}${o.note ? `: ${o.note}` : ""})`).join("; ")}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ═══════ ЖУРНАЛ ═══════
export function LogPanel({ s }: { s: GameState }) {
  return (
    <Panel title="Журнал решений">
      <ul className="max-h-[70vh] space-y-1 overflow-y-auto text-sm text-slate-300">{s.log.map((l, i) => <li key={i}>• {l}</li>)}</ul>
    </Panel>
  );
}
