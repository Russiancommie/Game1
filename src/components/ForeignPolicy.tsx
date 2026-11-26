"use client";
import { useMemo, useState } from "react";
import { ALL_CAMPAIGNS } from "@/game/data/campaigns";
import { WORLD_COUNTRIES, type WorldCountry } from "@/game/data/world";
import type { DiplomacyAction } from "@/game/engine";
import { diplomacyAction } from "@/game/engine";
import type { GameState } from "@/game/types";
import { CampaignCard } from "./CampaignPanels";
import { Btn, Flag, Panel } from "./ui";

function relationLabel(value: number) {
  if (value >= 60) return "Партнёрские";
  if (value >= 20) return "Дружественные";
  if (value <= -40) return "Напряжённые";
  if (value <= -10) return "Сложные";
  return "Рабочие";
}

export function ForeignPolicy({ s, set }: { s: GameState; set: (state: GameState) => void }) {
  const [selected, setSelected] = useState<WorldCountry | null>(null);
  const [query, setQuery] = useState("");
  const countries = useMemo(() => WORLD_COUNTRIES.filter((country) =>
    `${country.nameRu} ${country.name} ${country.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ), [query]);
  const campaigns = selected ? ALL_CAMPAIGNS.filter((campaign) => campaign.countryId === selected.id) : [];
  const settlement = selected ? s.settlements[selected.id] : undefined;

  const act = (action: DiplomacyAction) => {
    if (!selected) return;
    set(diplomacyAction(s, selected.id, action, selected.nameRu));
  };

  return (
    <div className="space-y-4">
      <Panel title="Внешняя политика">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300">Интерактивная карта государств. Нажмите на страну, чтобы открыть дипломатическое окно: развивайте отношения, предлагайте торговлю или помощь и выбирайте кампании для вмешательства.</p>
          <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">{WORLD_COUNTRIES.length} стран и территорий</span>
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="Карта мира">
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#07111f]">
            <svg viewBox="0 0 960 460" role="img" aria-label="Интерактивная карта мира: нажмите на страну для дипломатии" className="block h-auto w-full">
              <defs>
                <pattern id="map-grid" width="80" height="52" patternUnits="userSpaceOnUse">
                  <path d="M 80 0 L 0 0 0 52" fill="none" stroke="#334155" strokeWidth=".45" opacity=".35" />
                </pattern>
              </defs>
              <rect width="960" height="460" fill="#07111f" />
              <rect width="960" height="460" fill="url(#map-grid)" />
              {WORLD_COUNTRIES.map((country) => {
                const active = selected?.id === country.id;
                const hasSettlement = !!s.settlements[country.id];
                const relation = s.relations[country.id] ?? 0;
                const fill = active ? "#f59e0b" : hasSettlement ? "#0e7490" : relation >= 20 ? "#2563eb" : "#334155";
                return (
                  <path
                    key={country.id}
                    d={country.path}
                    role="button"
                    tabIndex={0}
                    aria-label={`${country.flag} ${country.nameRu}, открыть дипломатию`}
                    onClick={() => setSelected(country)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(country); } }}
                    className="cursor-pointer outline-none transition-colors hover:fill-amber-300 focus:fill-amber-300"
                    fill={fill}
                    stroke="#0b1220"
                    strokeWidth=".7"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{country.flag} {country.nameRu} · {country.name}</title>
                  </path>
                );
              })}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-600" />Государство</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" />Отношения укреплены</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-cyan-700" />Изменён политический итог</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />Выбрано</span>
            <span className="ml-auto text-slate-500">Картографические данные: Natural Earth, детализация 1:10m</span>
          </div>
        </Panel>

        <Panel title={`Государства · ${countries.length}`}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти страну…"
            aria-label="Поиск страны"
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <div className="max-h-[530px] space-y-1 overflow-y-auto pr-1">
            {countries.map((country) => (
              <button key={country.id} onClick={() => setSelected(country)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${selected?.id === country.id ? "bg-sky-900/60 text-white" : "text-slate-300 hover:bg-slate-700/70"}`}>
                <Flag flag={country.flag} label={country.nameRu} className="w-7 text-lg" />
                <span className="min-w-0 flex-1 truncate">{country.nameRu}</span>
                <span className="text-[10px] text-slate-500">{country.id}</span>
              </button>
            ))}
            {countries.length === 0 && <div className="p-3 text-xs text-slate-500">Страна не найдена.</div>}
          </div>
        </Panel>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="country-diplomacy-title" className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Flag flag={selected.flag} label={selected.nameRu} className="h-14 w-16 rounded-xl border border-slate-700 bg-slate-800 text-4xl" />
                <div>
                  <h2 id="country-diplomacy-title" className="text-xl font-extrabold text-white">{selected.nameRu}</h2>
                  <div className="text-sm text-slate-400">{selected.name} · столица: {selected.capital || "не указана"} · {selected.region || "регион не указан"}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Закрыть окно дипломатии" className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">✕</button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div className="space-y-3">
                <Panel title="Дипломатический статус">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="text-xs text-slate-500">Отношения с Москвой</div><div className="text-lg font-bold">{relationLabel(s.relations[selected.id] ?? 0)}</div></div>
                    <div className="text-right"><div className="text-xs text-slate-500">Уровень</div><div className="font-mono text-lg text-sky-300">{Math.round(s.relations[selected.id] ?? 0)}</div></div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, ((s.relations[selected.id] ?? 0) + 100) / 2))}%` }} /></div>
                  {settlement ? (
                    <div className="mt-3 rounded-lg border border-cyan-900 bg-cyan-950/30 p-3 text-sm">
                      <div className="font-semibold text-cyan-100">Изменение после кампании</div>
                      <div className="mt-1 text-slate-300">{settlement.government}</div>
                      <div className="text-xs text-slate-400">Лидер: {settlement.leader} · курс: {settlement.ideology}</div>
                      <p className="mt-2 text-xs text-slate-400">{settlement.summary}</p>
                    </div>
                  ) : <p className="mt-3 text-xs text-slate-500">Правительство и лидер пока соответствуют исторической линии; дипломатические решения здесь сохраняются отдельно от военного исхода.</p>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Btn kind="ghost" disabled={s.st.pc < 2} onClick={() => act("dialogue")}>Переговоры · −2 ПК</Btn>
                    <Btn kind="ghost" disabled={s.st.fd < 25} onClick={() => act("trade")}>Торговля · −25 млн</Btn>
                    <Btn kind="ghost" disabled={s.st.pc < 1 || s.st.fd < 20} onClick={() => act("humanitarian")}>Гуманитарная помощь</Btn>
                    <Btn kind="ghost" disabled={s.st.pc < 5 || s.st.fd < 10} onClick={() => act("influence")}>Расширить влияние</Btn>
                  </div>
                </Panel>
                <Panel title="Национальный профиль">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-900 p-2"><div className="text-slate-500">Регион</div><b>{selected.region || "—"}</b></div>
                    <div className="rounded-lg bg-slate-900 p-2"><div className="text-slate-500">Субрегион</div><b>{selected.subregion || "—"}</b></div>
                    <div className="rounded-lg bg-slate-900 p-2"><div className="text-slate-500">Код</div><b>{selected.id} · {selected.iso3}</b></div>
                    <div className="rounded-lg bg-slate-900 p-2"><div className="text-slate-500">Столица</div><b>{selected.capital || "—"}</b></div>
                  </div>
                </Panel>
              </div>
              <div className="space-y-3">
                <Panel title="Войны и политические конфликты">
                  <p className="mb-3 text-xs text-slate-400">Здесь же можно выбрать сторону и фракцию для вмешательства — отдельный переход во вкладку конфликтов не требуется.</p>
                  <div className="space-y-3">
                    {campaigns.map((campaign) => <CampaignCard key={campaign.id} scenario={campaign} s={s} set={set} compact />)}
                    {campaigns.length === 0 && <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">Для этой страны в каталоге нет отдельной кампании. Дипломатические решения доступны; полный список сценариев находится во вкладках «Войны» и «Конфликты».</div>}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
