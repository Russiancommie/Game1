"use client";
import type { CampaignScenario, GameState } from "@/game/types";
import { WORLD_COUNTRIES, COUNTRY_BY_ID } from "@/game/data/world";
import { POLITICAL_CONFLICTS, WARS } from "@/game/data/campaigns";
import { finishCampaign, interveneInCampaign, selectCampaignFaction } from "@/game/engine";
import { Bar, Btn, Panel, Portrait } from "./ui";

interface CampaignProps {
  scenario: CampaignScenario;
  s: GameState;
  set: (state: GameState) => void;
  compact?: boolean;
}

const PERIOD = (years: [number, number]) => `${years[0]}–${years[1] >= 2026 ? "н.в." : years[1]}`;

export function CampaignCard({ scenario, s, set, compact = false }: CampaignProps) {
  const progress = s.campaigns[scenario.id];
  if (!progress) return null;
  const country = COUNTRY_BY_ID[scenario.countryId];
  const selectedSide = scenario.sides.find((side) => side.id === progress.sideId);
  const selectedFaction = selectedSide?.factions.find((faction) => faction.id === progress.factionId);
  const resolved = progress.status === "resolved";
  const selectionLocked = resolved || progress.operations > 0;
  const isArchived = scenario.years[1] < s.year;

  return (
    <article className={`rounded-xl border border-slate-700 bg-slate-900/65 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-2xl">
          {country?.flag ?? "⚑"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-white">{scenario.title}</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">{PERIOD(scenario.years)}</span>
            {isArchived && progress.status === "open" && <span className="rounded-full bg-amber-950 px-2 py-0.5 text-[10px] text-amber-200">архивный сценарий</span>}
            {scenario.region && <span className="text-xs text-slate-500">{scenario.region}</span>}
          </div>
          {country && <div className="mt-0.5 text-xs text-slate-400">{country.nameRu} · {country.capital || country.region}</div>}
        </div>
      </div>

      {!compact && <p className="mt-3 text-sm leading-relaxed text-slate-300">{scenario.background}</p>}

      {progress.status === "resolved" && progress.result ? (
        <div className="mt-3 rounded-lg border border-emerald-800/70 bg-emerald-950/40 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <span>{progress.result.historical ? "📜 Историческая развязка" : "🏁 Фракция победила"}</span>
            <span className="text-emerald-300/70">· {progress.result.date}</span>
          </div>
          <div className="mt-1 text-sm text-white">{progress.result.factionName} — лидер: {progress.result.leader}</div>
          <div className="mt-1 text-xs text-slate-300">Новое правительство: <b>{progress.result.government}</b></div>
          <div className="text-xs text-slate-300">Курс страны: <b>{progress.result.ideology}</b></div>
          <p className="mt-2 text-sm text-slate-300">{progress.result.summary}</p>
        </div>
      ) : (
        <>
          {!compact && <div className="mt-3 rounded-lg bg-slate-800/70 p-2 text-xs text-slate-400"><b className="text-slate-300">Исторический итог:</b> {scenario.historicalResult}</div>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Сторона
              <select
                value={progress.sideId ?? ""}
                disabled={selectionLocked}
                onChange={(event) => {
                  const sideId = event.target.value;
                  const side = scenario.sides.find((candidate) => candidate.id === sideId);
                  if (side?.factions[0]) set(selectCampaignFaction(s, scenario.id, side.id, side.factions[0].id));
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-60"
              >
                <option value="">Выберите сторону…</option>
                {scenario.sides.map((side) => <option key={side.id} value={side.id}>{side.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Фракция и лидер
              <select
                value={progress.factionId ?? ""}
                disabled={selectionLocked || !selectedSide}
                onChange={(event) => selectedSide && set(selectCampaignFaction(s, scenario.id, selectedSide.id, event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-60"
              >
                {!selectedSide && <option value="">Сначала выберите сторону</option>}
                {selectedSide?.factions.map((faction) => <option key={faction.id} value={faction.id}>{faction.name} · {faction.leader}</option>)}
              </select>
            </label>
          </div>
          {selectedSide && <p className="mt-2 text-xs leading-relaxed text-slate-400">{selectedSide.description}</p>}
          {selectedFaction && (
            <div className="mt-2 flex gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <Portrait name={selectedFaction.leader} color="#64748b" className="h-16 w-14" />
              <div className="min-w-0 text-xs">
                <div className="font-semibold text-slate-200">{selectedFaction.name} · {selectedFaction.leader}</div>
                <p className="mt-1 text-slate-400">{selectedFaction.profile}</p>
                {!compact && <p className="mt-1 text-slate-500">При победе: {selectedFaction.outcome.government} · {selectedFaction.outcome.ideology}</p>}
              </div>
            </div>
          )}

          <div className="mt-3 rounded-lg bg-slate-800/60 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-300">Поддержка выбранной фракции</span>
              <b className="text-sky-300">{Math.round(progress.support)} / 65</b>
            </div>
            <div className="mt-2"><Bar v={progress.support} max={65} color="#38bdf8" /></div>
            <p className="mt-2 text-[11px] text-slate-500">Наберите 65 пунктов влияния: выбранная фракция победит, а лидер, правительство и идеологический курс страны обновятся. После первого вмешательства фракцию изменить нельзя, но поддержку можно продолжать. Можно также принять исторический исход.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn kind="ghost" disabled={!selectedFaction || resolved || s.st.pc < 3} onClick={() => set(interveneInCampaign(s, scenario.id, "diplomatic"))}>Дипломатия · −3 ПК / +22</Btn>
              <Btn kind="ghost" disabled={!selectedFaction || resolved || s.st.fd < 25} onClick={() => set(interveneInCampaign(s, scenario.id, "funding"))}>Финансирование · −25 млн / +34</Btn>
              <Btn kind="ghost" disabled={!selectedFaction || resolved || s.st.pc < 5 || s.st.fd < 20} onClick={() => set(interveneInCampaign(s, scenario.id, "advisers"))}>Советники · −5 ПК, −20 млн / +45</Btn>
              <Btn kind="good" disabled={resolved} onClick={() => set(finishCampaign(s, scenario.id, true))}>Принять исторический исход</Btn>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

export function CampaignPanel({ kind, s, set }: { kind: "war" | "political"; s: GameState; set: (state: GameState) => void }) {
  const scenarios = kind === "war" ? WARS : POLITICAL_CONFLICTS;
  const resolved = scenarios.filter((scenario) => s.campaigns[scenario.id]?.status === "resolved").length;
  return (
    <div className="space-y-4">
      <Panel title={kind === "war" ? "Военные кампании" : "Политические конфликты"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
            {kind === "war"
              ? "Исторические войны и мирные кампании. Выберите сторону и её фракцию, затем вкладывайте политический капитал или средства. Имена лидеров и историческая линия указаны отдельно; альтернативные исходы помечены."
              : "Перевороты, восстания и протестные движения без статуса войны. Внутри каждой стороны есть реальные политические течения и лидеры; поддержка фракции может изменить состав власти и идеологию государства."}
          </p>
          <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">Исходы: {resolved}/{scenarios.length}</span>
        </div>
      </Panel>
      <div className="grid gap-3 xl:grid-cols-2">
        {scenarios.map((scenario) => <CampaignCard key={scenario.id} scenario={scenario} s={s} set={set} />)}
      </div>
      <Panel title="Последствия по странам">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(s.settlements).map(([countryId, settlement]) => {
            const country = COUNTRY_BY_ID[countryId];
            return (
              <div key={countryId} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
                <div className="font-semibold">{country?.flag ?? "⚑"} {country?.nameRu ?? countryId}</div>
                <div className="mt-1 text-xs text-slate-400">{settlement.government} · лидер: {settlement.leader}</div>
                <div className="text-xs text-sky-300">{settlement.ideology}</div>
              </div>
            );
          })}
          {Object.keys(s.settlements).length === 0 && <div className="text-sm text-slate-500">После разрешения кампании здесь появятся новое правительство, лидер и идеологический курс государства.</div>}
        </div>
      </Panel>
    </div>
  );
}
