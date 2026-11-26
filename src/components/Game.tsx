"use client";
import { useEffect, useState } from "react";
import type { DiffId, GameState } from "@/game/types";
import { DIFFS, FACTIONS, IDEOLOGIES, SUBS } from "@/game/data/core";
import { ALL_EVENTS, LEGACY_SAVE_KEY, SAVE_KEY, createCustomMember, dateStr, normalizeSave, newGame, nextMonth, finalScore } from "@/game/engine";
import type { ElectionReport } from "@/game/engine";
import { FOCUS } from "@/game/data/focus";
import { MEMBERS } from "@/game/data/people";
import { ORGS, RIVALS } from "@/game/data/parties";
import { CampaignPanel } from "./CampaignPanels";
import { ForeignPolicy } from "./ForeignPolicy";
import { Factions, FocusTrees, Government, Ideology, LogPanel, Members, Opponents, Overview, Systems } from "./Panels";
import { CongressModal, ElectionModal, EventModal, Notice } from "./Modals";
import { Btn, Portrait } from "./ui";

const TABS = [
  ["ov", "📊 Обзор"], ["mem", "🧑‍💼 Партийцы"], ["fac", "⚔️ Фракции"], ["ide", "🎯 Идеология"], ["foc", "🌳 Решения"],
  ["gov", "🏛️ Правительство"], ["sys", "⚙️ Системы"], ["opp", "🎭 Оппоненты"], ["war", "🪖 Войны"],
  ["con", "⚠️ Конфликты"], ["ext", "🌍 Внешняя политика"], ["log", "📜 Журнал"],
] as const;
type Tab = (typeof TABS)[number][0];

const PLAYABLES = [
  { id: "putin", name: "Владимир Путин", role: "Национальный лидер", text: "Ставка на вертикаль управления и фракцию силовиков.", color: "#b91c1c" },
  { id: "gryzlov", name: "Борис Грызлов", role: "Председатель партии", text: "Парламентская дисциплина и сплочение партийного аппарата.", color: "#7c3aed" },
  { id: "medvedev", name: "Дмитрий Медведев", role: "Модернизатор", text: "Технологии, правовые реформы и обновление институтов.", color: "#0891b2" },
  { id: "kudrin", name: "Алексей Кудрин", role: "Экономический технократ", text: "Бюджетная дисциплина, рынок и макроэкономическая устойчивость.", color: "#2563eb" },
] as const;
const CUSTOM_CHARACTERS = ["Дипломат", "Организатор", "Технократ", "Популист", "Силовик"];
const CUSTOM_ECONOMIES = ["Рыночный прагматик", "Социальный государственник", "Плановый модернизатор", "Государственный индустриалист"];
const CUSTOM_TRAITS = ["переговорщик", "реформатор", "антикоррупционер", "патриот", "организатор", "социальный лидер", "цифровизатор", "популярный оратор"];

export default function Game() {
  const [s, setS] = useState<GameState | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [tab, setTab] = useState<Tab>("ov");
  const [report, setReport] = useState<ElectionReport | null>(null);
  const [notice, setNotice] = useState<{ title: string; lines: string[] } | null>(null);
  const [playAs, setPlayAs] = useState<string>("putin");
  const [buildCustomMember, setBuildCustomMember] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCharacter, setCustomCharacter] = useState(CUSTOM_CHARACTERS[0]);
  const [customEconomy, setCustomEconomy] = useState(CUSTOM_ECONOMIES[0]);
  const [customSympathy, setCustomSympathy] = useState("mod");
  const [customTraits, setCustomTraits] = useState<string[]>(["переговорщик", "реформатор"]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
        if (raw) setHasSave(true);
      } catch { /* ignore */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (s && !s.over) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    }
  }, [s]);

  const load = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
      if (!raw) return;
      const restored = normalizeSave(JSON.parse(raw));
      if (restored) { setS(restored); setTab("ov"); }
    } catch { /* ignore */ }
  };
  const start = (d: DiffId) => {
    const customMember = buildCustomMember ? createCustomMember({
      name: customName, character: customCharacter, economy: customEconomy, sympathy: customSympathy, traits: customTraits,
    }) : undefined;
    setS(newGame(d, { playAs: customMember ? customMember.id : playAs, customMember }));
    setHasSave(true);
    setTab("ov");
  };
  const set = (n: GameState) => setS(n);

  if (!ready) return <div className="p-10 text-slate-400">Загрузка…</div>;

  if (!s) {
    const picked = PLAYABLES.find((player) => player.id === playAs) ?? PLAYABLES[0];
    const sympathy = FACTIONS.find((faction) => faction.id === customSympathy);
    return (
      <main className="mx-auto max-w-7xl px-4 py-7 md:px-6">
        <header className="relative overflow-hidden rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-900 to-[#11101a] p-6 shadow-2xl md:p-9">
          <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-red-950/25 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-amber-800/70 bg-amber-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.2em] text-amber-200">Политическая стратегия · 2003–2026</span>
              {hasSave && <Btn kind="good" onClick={load}>▶ Продолжить сохранённую игру</Btn>}
            </div>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white md:text-7xl">Кремль:<span className="text-red-400">2K</span></h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">Историческая политическая стратегия о партии, фракциях и внешней политике. Выбирайте лидера, ведите курс через датированные события, меняйте идеологию, участвуйте в войнах и конфликтах, влияйте на правительства других стран.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-slate-200"><b className="text-amber-200">{ALL_EVENTS.length}</b> датированных исторических событий</span>
              <span className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-slate-200"><b className="text-sky-200">{FOCUS.length}</b> решений в 4 деревьях</span>
              <span className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-slate-200"><b className="text-emerald-200">{MEMBERS.length}</b> партийцев</span>
              <span className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-slate-200"><b className="text-violet-200">{IDEOLOGIES.length}</b> идеологий · {SUBS.length} субидеологий</span>
              <span className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-slate-200">{RIVALS.length} партий · {ORGS.length} организаций</span>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
          <section className="space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-sky-300">01 · персонаж</div>
              <h2 className="mt-1 text-2xl font-bold text-white">За кого вы играете?</h2>
              <p className="mt-1 text-sm text-slate-400">Выберите политического деятеля или создайте своего партийца. Профиль и фракционная симпатия появятся во вкладке «Партийцы».</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLAYABLES.map((player) => (
                <button key={player.id} onClick={() => { setPlayAs(player.id); setBuildCustomMember(false); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${playAs === player.id && !buildCustomMember ? "border-sky-400 bg-sky-950/40 ring-1 ring-sky-500/40" : "border-slate-700 bg-slate-800/70 hover:border-slate-500"}`}>
                  <Portrait name={player.name} color={player.color} className="h-20 w-16" />
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">{player.role}</span>
                    <span className="mt-0.5 block font-semibold text-white">{player.name}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">{player.text}</span>
                  </span>
                </button>
              ))}
              <button onClick={() => setBuildCustomMember((value) => !value)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${buildCustomMember ? "border-amber-400 bg-amber-950/30 ring-1 ring-amber-500/30" : "border-slate-700 bg-slate-800/70 hover:border-amber-500/70"}`}>
                <Portrait name={customName || "Новый партийный деятель"} color={sympathy?.color ?? "#d97706"} className="h-20 w-16" />
                <span><span className="block text-[10px] uppercase tracking-wide text-amber-300">Свой персонаж</span><span className="mt-0.5 block font-semibold text-white">Создать партийца</span><span className="mt-1 block text-xs text-slate-400">Характер, экономика, фракция и особенности</span></span>
              </button>
            </div>

            {buildCustomMember && (
              <div className="rounded-2xl border border-amber-800/60 bg-slate-900/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><h3 className="font-semibold text-amber-100">Позиции партийца</h3><p className="text-xs text-slate-400">Настройте профиль; выбранный характер и экономический курс влияют на его игровое решение.</p></div>
                  <Portrait name={customName || "Новый партийный деятель"} color={sympathy?.color ?? "#d97706"} className="h-16 w-12" />
                </div>
                <label className="block text-xs text-slate-400">Имя
                  <input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={48} placeholder="Например, Алексей Петров" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">Характер
                    <select value={customCharacter} onChange={(event) => setCustomCharacter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white">{CUSTOM_CHARACTERS.map((value) => <option key={value}>{value}</option>)}</select>
                  </label>
                  <label className="text-xs text-slate-400">Экономические взгляды
                    <select value={customEconomy} onChange={(event) => setCustomEconomy(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white">{CUSTOM_ECONOMIES.map((value) => <option key={value}>{value}</option>)}</select>
                  </label>
                  <label className="text-xs text-slate-400 sm:col-span-2">Фракция, которой сочувствует
                    <select value={customSympathy} onChange={(event) => setCustomSympathy(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white">{FACTIONS.map((faction) => <option key={faction.id} value={faction.id}>{faction.name}</option>)}</select>
                  </label>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs text-slate-400">Особенности · выберите до четырёх</div>
                  <div className="flex flex-wrap gap-1.5">{CUSTOM_TRAITS.map((trait) => {
                    const active = customTraits.includes(trait);
                    return <button key={trait} aria-pressed={active} onClick={() => setCustomTraits((items) => active ? items.filter((item) => item !== trait) : items.length < 4 ? [...items, trait] : items)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${active ? "border-amber-500 bg-amber-950/50 text-amber-100" : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500"}`}>{trait}</button>;
                  })}</div>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-amber-300">02 · сложность</div>
              <h2 className="mt-1 text-2xl font-bold text-white">Настройте кампанию</h2>
              <p className="mt-1 text-sm text-slate-400">Начало игры: январь 2003 года. Выбранный персонаж: <b className="text-slate-200">{buildCustomMember ? (customName || "Новый партийный деятель") : picked.name}</b>.</p>
            </div>
            <div className="space-y-2">
              {DIFFS.map((d) => (
                <button key={d.id} onClick={() => start(d.id)} className="group w-full rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-left transition hover:border-amber-500/70 hover:bg-slate-800">
                  <div className="flex items-center justify-between gap-3"><span className="text-base font-bold text-white">{d.name}</span><span className="text-xs text-amber-300 opacity-0 transition group-hover:opacity-100">Начать →</span></div>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-400">{d.desc}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-relaxed text-slate-500">События появляются только в исторические даты; случайные филлерные ивенты отключены. Персонажи в игре — игровые профили, а альтернативные исходы в кампаниях помечены отдельно.</div>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <span>Сохранение работает автоматически в браузере.</span>
          <span className="font-semibold tracking-wide text-amber-300">Версия: Пре-Альфа</span>
        </footer>
      </main>
    );
  }

  const hasEvents = s.queue.length > 0;
  const pending = !hasEvents && !s.over ? s.pending : null;
  const can = !hasEvents && !pending && !s.over && !report && !notice;
  const playerTitle = s.customMembers.find((member) => member.id === s.playAs)?.name ?? PLAYABLES.find((player) => player.id === s.playAs)?.name ?? s.playAs;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
          <div className="text-lg font-black text-white">Кремль:<span className="text-red-400">2K</span></div>
          <div className="font-semibold capitalize text-slate-200">📅 {dateStr(s)}</div>
          <div title="За кого вы играете" className="text-sky-200">👤 {playerTitle}</div>
          <div title="Название партии">🏛️ {s.partyName}</div>
          <div title="Рейтинг">📊 {Math.round(s.st.ap)}%</div>
          <div title="Политкапитал">🪙 {Math.round(s.st.pc)} ПК</div>
          <div title="Касса">💰 {Math.round(s.st.fd)} млн</div>
          <div title="Единство">🤝 {Math.round(s.st.un)}</div>
          <div title="Стабильность">🏛️ {Math.round(s.st.stb)}</div>
          <div title="Экономика">🏭 {Math.round(s.st.ec)}</div>
          <div title="Свободы">🕊️ {Math.round(s.st.fr)}</div>
          <div title="Мандаты">🗳️ {Math.round(s.seats)}%</div>
          <div className="ml-auto flex gap-2">
            <Btn kind="ghost" onClick={() => { if (confirm("Начать новую игру? Текущий прогресс будет потерян.")) { setS(null); } }}>Меню</Btn>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${tab === id ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{label}</button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {tab === "ov" && <Overview s={s} />}
        {tab === "mem" && <Members s={s} set={set} />}
        {tab === "fac" && <Factions s={s} set={set} />}
        {tab === "ide" && <Ideology s={s} set={set} />}
        {tab === "foc" && <FocusTrees s={s} set={set} />}
        {tab === "gov" && <Government s={s} set={set} />}
        {tab === "sys" && <Systems s={s} />}
        {tab === "opp" && <Opponents s={s} set={set} />}
        {tab === "war" && <CampaignPanel kind="war" s={s} set={set} />}
        {tab === "con" && <CampaignPanel kind="political" s={s} set={set} />}
        {tab === "ext" && <ForeignPolicy s={s} set={set} />}
        {tab === "log" && <LogPanel s={s} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-900/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {hasEvents ? `Нужно решить события: ${s.queue.length}` : pending ? "Ожидает решения: " + (pending.type === "election" ? "выборы" : "съезд партии") : s.over ? "Игра окончена" : "Все дела месяца сделаны — можно идти дальше."}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider text-amber-300 sm:text-[10px]">Версия: Пре-Альфа</span>
            <Btn disabled={!can} onClick={() => set(nextMonth(s))} className="px-6 py-2 text-base">Следующий месяц ▶</Btn>
          </div>
        </div>
      </div>

      {hasEvents && !report && !notice && <EventModal s={s} set={set} />}
      {pending?.type === "election" && !notice && <ElectionModal s={s} set={set} report={report} setReport={setReport} />}
      {pending?.type === "congress" && !notice && <CongressModal s={s} set={set} notify={(title, lines) => setNotice({ title, lines })} />}
      {!pending && report && <ElectionModal s={s} set={set} report={report} setReport={setReport} />}
      {notice && <Notice title={notice.title} lines={notice.lines} onClose={() => setNotice(null)} />}

      {s.over && !report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-xl rounded-2xl border border-slate-600 bg-slate-800 p-6 text-center shadow-2xl">
            <div className="text-5xl">{s.over.win ? "🏆" : "💥"}</div>
            <h2 className="mt-2 text-2xl font-extrabold">{s.over.title}</h2>
            <p className="mt-2 text-slate-300">{s.over.text}</p>
            <p className="mt-2 text-sm text-slate-400">Итоговый счёт: {finalScore(s)}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Btn onClick={() => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } setHasSave(false); setS(null); }}>В главное меню</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
