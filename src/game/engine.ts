import type { CampaignProgress, CampaignResult, CampaignScenario, DiffId, Eff, FocusNode, GEvent, GameState, Member, Opt, StatKey, TreeId } from "./types";
import {
  ALL_SYS, CONGRESSES, DIFFS, ELECTIONS, FACTIONS, FAC_START, IDEOLOGIES, MONTHS, OIL_BY_YEAR, PARLIAMENTS, START_STATS, SUB_BY_ID, SUBS,
} from "./data/core";
import { CANDIDATES, MEMBERS } from "./data/people";
import type { Candidate } from "./data/people";
import { ORGS, RIVALS } from "./data/parties";
import { FOCUS, FOCUS_BY_ID } from "./data/focus";
import { BILLS, BUDGETS, MINISTRIES, govSupport, primeMinister } from "./data/gov";
import { REAL_EVENTS } from "./data/events_real";
import { ALL_CAMPAIGNS } from "./data/campaigns";

export const SAVE_KEY = "kreml2k_prealpha_v3";
export const LEGACY_SAVE_KEY = "er_sim_v2";
export const ALL_EVENTS: GEvent[] = REAL_EVENTS;
export const CAMPAIGN_BY_ID = Object.fromEntries(ALL_CAMPAIGNS.map((campaign) => [campaign.id, campaign]));
export const EV_BY_ID: Record<string, GEvent> = Object.fromEntries(ALL_EVENTS.map((e) => [e.id, e]));
export const DIFF_BY_ID = Object.fromEntries(DIFFS.map((d) => [d.id, d]));
const STAT_KEYS = ["ap", "pc", "fd", "un", "stb", "ec", "lv", "ml", "pr", "fr", "co"];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function dateStr(s: GameState) {
  return `${MONTHS[s.month - 1]} ${s.year}`;
}

export function leaderOf(facId: string, year: number): string {
  const f = FACTIONS.find((x) => x.id === facId);
  if (!f) return "";
  let name = f.leaders[0][1];
  for (const [y, n] of f.leaders) if (year >= y) name = n;
  return name;
}

export function fmt(text: string, s: GameState): string {
  return text
    .replace(/\{L:(\w+)\}/g, (_m, id) => leaderOf(id, s.year))
    .replace(/\{PM\}/g, primeMinister(s.year, s.month))
    .replace(/\{PRES\}/g, CANDIDATES.find((c) => c.id === s.president)?.name ?? "Президент")
    .replace(/\{PARTY\}/g, s.partyName || "Единая Россия");
}

export interface NewGameOptions { playAs?: string; customMember?: Member }
export const DEFAULT_PARTY_NAME = "Единая Россия";

// ───────── Создание игры ─────────
export function newGame(diff: DiffId, options: NewGameOptions = {}): GameState {
  const customMembers = options.customMember ? [options.customMember] : [];
  const playAs = options.playAs ?? "putin";
  const s: GameState = {
    v: 3, diff, year: 2003, month: 1,
    st: { ...START_STATS, pc: START_STATS.pc + (diff === "sandbox" ? 30 : 0) },
    oil: OIL_BY_YEAR[2003],
    ide: { con: 24, cen: 19, sta: 17, pop: 9, lib: 6, nat: 6, eur: 5, soc: 5, com: 4, isl: 2.5, scl: 2.5 },
    mainIde: "cen", sub: "cen_pov",
    fac: { ...FAC_START }, facLoy: Object.fromEntries(FACTIONS.map((f) => [f.id, 60])),
    mem: Object.fromEntries([...MEMBERS, ...customMembers].map((m) => [m.id, { loy: m.loy, cd: 0, used: 0 }])),
    customMembers,
    playAs,
    partyName: DEFAULT_PARTY_NAME,
    riv: Object.fromEntries(RIVALS.map((r) => [r.id, r.from <= 2003 && r.to >= 2003 ? { r: r.r, alive: true } : { r: -1, alive: false }])),
    org: Object.fromEntries(ORGS.map((o) => [o.id, o.from <= 2003 ? { p: o.p, status: "active" as const } : { p: 0, status: "pending" as const }])),
    eco: "eco_mix", gov: "gov_sf", par: "par_mix",
    focus: { eco: { done: [], cur: null, left: 0 }, pol: { done: [], cur: null, left: 0 }, army: { done: [], cur: null, left: 0 }, dip: { done: [], cur: null, left: 0 } },
    flags: { consec: 1 },
    fired: [], queue: [],
    cabinet: Object.fromEntries(MINISTRIES.map((m) => [m.id, m.def])),
    passed: [], billOffer: [], billTried: [],
    mods: {}, seats: 45, president: "putin", chair: "gryzlov", budget: "bal",
    campaigns: Object.fromEntries(ALL_CAMPAIGNS.map((campaign) => [campaign.id, { sideId: null, factionId: null, support: 0, operations: 0, status: "open" as const, result: null }])),
    relations: {}, settlements: {},
    log: [`Январь 2003: вы возглавили аппарат партии «${DEFAULT_PARTY_NAME}». Впереди выборы в Госдуму.`],
    pending: null, over: null, chosenToday: 0,
    hist: [],
  };
  const personaBonuses: Record<string, Eff> = {
    putin: { un: 2, stb: 1, "f.sil": 2 },
    gryzlov: { seat: 4, un: 2, "f.ide": 1 },
    medvedev: { fr: 2, ec: 2, "f.mod": 2 },
    kudrin: { pc: 5, ec: 2, ap: -1, "f.lib": 2 },
  };
  const bonus = customMembers[0] ? { un: 1, pc: 3, [`f.${customMembers[0].fac}`]: 2 } : personaBonuses[playAs];
  if (bonus) applyEff(s, bonus, true);
  genMonth(s);
  return s;
}

export function normalizeSave(value: unknown): GameState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<GameState>;
  if (!raw.diff || !(raw.diff in DIFF_BY_ID)) return null;
  const customMembers = Array.isArray(raw.customMembers) ? raw.customMembers : [];
  const base = newGame(raw.diff, { playAs: raw.playAs ?? "putin", customMember: customMembers[0] });
  const validEvents = new Set(ALL_EVENTS.map((event) => event.id));
  const mem = { ...base.mem, ...(raw.mem ?? {}) };
  for (const member of customMembers) mem[member.id] ??= { loy: member.loy, cd: 0, used: 0 };
  return {
    ...base,
    ...raw,
    v: 3,
    partyName: typeof raw.partyName === "string" && raw.partyName.trim() ? raw.partyName.trim().slice(0, 48) : DEFAULT_PARTY_NAME,
    playAs: typeof raw.playAs === "string" ? raw.playAs : "putin",
    customMembers,
    mem,
    campaigns: { ...base.campaigns, ...(raw.campaigns ?? {}) },
    relations: raw.relations ?? {},
    settlements: raw.settlements ?? {},
    queue: Array.isArray(raw.queue) ? raw.queue.filter((id) => validEvents.has(id)) : base.queue,
    fired: Array.isArray(raw.fired) ? raw.fired.filter((id) => validEvents.has(id)) : base.fired,
    log: Array.isArray(raw.log) ? raw.log.filter((line): line is string => typeof line === "string").slice(0, 120) : base.log,
    hist: Array.isArray(raw.hist) ? raw.hist : [],
  } as GameState;
}

// ───────── Эффекты ─────────
function setSys(s: GameState, k: string, v: string) {
  if (k === "eco" || k === "gov" || k === "par") {
    if (s[k] !== v && ALL_SYS[v]) {
      s[k] = v;
      s.log.unshift(`${dateStr(s)}: смена системы → «${ALL_SYS[v].name}»`);
    }
  }
}

function addMods(s: GameState, e: Eff, k: number) {
  for (const [key, v] of Object.entries(e)) {
    if (typeof v === "number" && STAT_KEYS.includes(key) && key !== "fd" && key !== "pc") s.mods[key] = clamp((s.mods[key] ?? 0) + v * k, -30, 30);
  }
}

function normIde(s: GameState) {
  const sum = Object.values(s.ide).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(s.ide)) s.ide[k] = (s.ide[k] / sum) * 100;
}

export function applyEff(s: GameState, e: Eff, raw = false) {
  const d = DIFF_BY_ID[s.diff];
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === "string") { setSys(s, k, v); continue; }
    if (STAT_KEYS.includes(k)) {
      const good = k === "co" ? v < 0 : v > 0;
      const key = k as StatKey;
      let dv = raw ? v : v * (good ? d.pos : d.neg);
      if (!raw && key !== "fd" && key !== "pc") {
        const x = s.st[key];
        const goodDir = key === "co" ? -1 : 1;
        // убывающая отдача у границ
        const up = (dv * goodDir) > 0;
        dv *= up ? clamp((key === "co" ? x + 5 : 105 - x) / 60, 0.15, 1.3) : clamp((key === "co" ? 105 - x : x + 15) / 60, 0.3, 1.3);
      }
      s.st[key] = clamp(s.st[key] + dv, 0, key === "fd" ? 99999 : 100);
    } else if (k.startsWith("f.")) {
      const id = k.slice(2);
      if (id in s.fac) s.fac[id] = clamp(s.fac[id] + v, 1, 60);
    } else if (k.startsWith("l.")) {
      const id = k.slice(2);
      if (id in s.facLoy) s.facLoy[id] = clamp(s.facLoy[id] + v, 0, 100);
    } else if (k.startsWith("m.")) {
      const id = k.slice(2);
      if (s.mem[id]) s.mem[id].loy = clamp(s.mem[id].loy + v, 0, 100);
    } else if (k.startsWith("r.")) {
      const id = k.slice(2);
      const r = s.riv[id];
      if (r && r.alive) r.r = clamp(r.r + v * d.rivalBoost * (v > 0 ? 1 : 1 / d.rivalBoost), 0.2, 40);
    } else if (k.startsWith("o.")) {
      const id = k.slice(2);
      const o = s.org[id];
      if (o && (o.status === "active" || o.status === "coopted")) {
        o.p = clamp(o.p + v, 0, 100);
        if (o.p <= 0.5) { o.status = "dissolved"; o.note = "угасла после давления"; s.log.unshift(`${dateStr(s)}: «${orgName(s, id)}» прекратила существование`); }
      }
    } else if (k.startsWith("i.")) {
      const id = k.slice(2);
      if (id in s.ide) { s.ide[id] = Math.max(0.5, s.ide[id] + v); normIde(s); }
    } else if (k === "seat") {
      s.seats = clamp(s.seats + v, 0, 100);
    } else if (k.startsWith("flag.")) {
      s.flags[k.slice(5)] = 1;
    } else if (k.startsWith("unflag.")) {
      delete s.flags[k.slice(7)];
    } else if (k.startsWith("kill.")) {
      const id = k.slice(5);
      if (s.riv[id]) { s.riv[id].alive = false; s.riv[id].r = 0; s.riv[id].note = "запрещена"; }
      if (s.org[id]) { s.org[id].status = "banned"; }
    }
  }
}

export function orgName(s: GameState, id: string): string {
  return ORGS.find((o) => o.id === id)?.name ?? s.org[id]?.name ?? id;
}
export function orgInfo(s: GameState, id: string) {
  const o = ORGS.find((x) => x.id === id);
  const st = s.org[id];
  return { name: o?.name ?? st?.name ?? id, leader: o?.leader ?? st?.leader ?? "—", ide: o?.ide ?? st?.ide ?? "cen" };
}

// ───────── События ─────────
export function eventOptions(ev: GEvent): Opt[] {
  const opts = ev.opts.slice();
  if (!opts.some((o) => Object.keys(o.e).length === 0)) opts.push({ t: ev.hist ? "Не вмешиваться" : "Не реагировать", e: ev.hist ? { ap: -1 } : {} });
  return opts;
}

export function resolveEvent(s0: GameState, evId: string, idx: number): GameState {
  const s = clone(s0);
  const ev = EV_BY_ID[evId];
  if (!ev) { s.queue = s.queue.filter((x) => x !== evId); return s; }
  const opt = eventOptions(ev)[idx];
  if (!opt) return s;
  if (opt.c && s.st.pc < opt.c) return s0;
  if (opt.c) s.st.pc -= opt.c;
  applyEff(s, opt.e);
  s.queue = s.queue.filter((x) => x !== evId);
  s.log.unshift(`${dateStr(s)}: ${ev.title} → ${opt.t}`);
  if (s.log.length > 120) s.log.length = 120;
  return s;
}

export type DiplomacyAction = "dialogue" | "trade" | "humanitarian" | "influence";

const DIPLOMACY_ACTIONS: Record<DiplomacyAction, { pc: number; fd: number; relation: number; effect: Eff; label: string }> = {
  dialogue: { pc: 2, fd: 0, relation: 8, effect: { pr: 0.5 }, label: "Открыть дипломатический канал" },
  trade: { pc: 0, fd: 25, relation: 12, effect: { ec: 1 }, label: "Предложить торговое соглашение" },
  humanitarian: { pc: 1, fd: 20, relation: 10, effect: { lv: 1, pr: 0.5 }, label: "Направить гуманитарную помощь" },
  influence: { pc: 5, fd: 10, relation: 16, effect: { pr: -0.5 }, label: "Расширить политическое влияние" },
};

export function diplomacyAction(s0: GameState, countryId: string, action: DiplomacyAction, countryName: string): GameState {
  const terms = DIPLOMACY_ACTIONS[action];
  if (!terms || s0.st.pc < terms.pc || s0.st.fd < terms.fd) return s0;
  const s = clone(s0);
  s.st.pc -= terms.pc;
  s.st.fd -= terms.fd;
  s.relations[countryId] = clamp((s.relations[countryId] ?? 0) + terms.relation, -100, 100);
  applyEff(s, terms.effect);
  s.log.unshift(`${dateStr(s)}: внешняя политика — ${terms.label}: ${countryName}`);
  return s;
}

export function selectCampaignFaction(s0: GameState, campaignId: string, sideId: string, factionId: string): GameState {
  const scenario = CAMPAIGN_BY_ID[campaignId] as CampaignScenario | undefined;
  const side = scenario?.sides.find((candidate) => candidate.id === sideId);
  const faction = side?.factions.find((candidate) => candidate.id === factionId);
  const progress = s0.campaigns?.[campaignId];
  if (!scenario || !side || !faction || !progress || progress.status === "resolved" || progress.operations > 0) return s0;
  const s = clone(s0);
  s.campaigns[campaignId].sideId = sideId;
  s.campaigns[campaignId].factionId = factionId;
  return s;
}

export type SupportMethod = "diplomatic" | "funding" | "advisers";
const SUPPORT_ACTIONS: Record<SupportMethod, { pc: number; fd: number; points: number; relation: number; effect: Eff; label: string }> = {
  diplomatic: { pc: 3, fd: 0, points: 22, relation: 3, effect: { pr: 0.5 }, label: "Дипломатическая поддержка" },
  funding: { pc: 0, fd: 25, points: 34, relation: 5, effect: { ap: -0.2 }, label: "Финансовая помощь" },
  advisers: { pc: 5, fd: 20, points: 45, relation: 7, effect: { ml: -0.5, pr: -0.5 }, label: "Советники и материальная помощь" },
};

export function finishCampaign(s0: GameState, campaignId: string, historical = false): GameState {
  const scenario = CAMPAIGN_BY_ID[campaignId] as CampaignScenario | undefined;
  const progress = s0.campaigns?.[campaignId];
  if (!scenario || !progress || progress.status === "resolved") return s0;
  if (!historical && (progress.support < 65 || !progress.sideId || !progress.factionId)) return s0;
  const sideId = historical ? scenario.historicalWinner.sideId : progress.sideId!;
  const factionId = historical ? scenario.historicalWinner.factionId : progress.factionId!;
  const side = scenario.sides.find((candidate) => candidate.id === sideId);
  const faction = side?.factions.find((candidate) => candidate.id === factionId);
  if (!side || !faction) return s0;
  const result: CampaignResult = {
    ...faction.outcome, sideId, factionId, sideName: side.name, factionName: faction.name,
    historical, date: dateStr(s0),
  };
  const s = clone(s0);
  const updated: CampaignProgress = { ...s.campaigns[campaignId], sideId, factionId, status: "resolved", result };
  s.campaigns[campaignId] = updated;
  s.settlements[scenario.countryId] = {
    scenarioId: scenario.id, government: result.government, leader: result.leader,
    ideology: result.ideology, summary: result.summary,
  };
  if (result.effects) applyEff(s, result.effects);
  s.log.unshift(`${dateStr(s)}: исход кампании «${scenario.title}» — победила фракция «${faction.name}» (${result.leader}).`);
  if (s.log.length > 120) s.log.length = 120;
  return s;
}

export function interveneInCampaign(s0: GameState, campaignId: string, method: SupportMethod): GameState {
  const scenario = CAMPAIGN_BY_ID[campaignId] as CampaignScenario | undefined;
  const progress = s0.campaigns?.[campaignId];
  const action = SUPPORT_ACTIONS[method];
  if (!scenario || !progress || !action || progress.status === "resolved" || !progress.sideId || !progress.factionId) return s0;
  if (s0.st.pc < action.pc || s0.st.fd < action.fd) return s0;
  const s = clone(s0);
  s.st.pc -= action.pc;
  s.st.fd -= action.fd;
  const current = s.campaigns[campaignId];
  current.support = clamp(current.support + action.points, 0, 100);
  current.operations += 1;
  s.relations[scenario.countryId] = clamp((s.relations[scenario.countryId] ?? 0) + action.relation, -100, 100);
  applyEff(s, action.effect);
  const side = scenario.sides.find((candidate) => candidate.id === current.sideId)!;
  const faction = side.factions.find((candidate) => candidate.id === current.factionId)!;
  s.log.unshift(`${dateStr(s)}: ${action.label} — «${faction.name}» в кампании «${scenario.title}».`);
  if (current.support >= 65) return finishCampaign(s, campaignId, false);
  return s;
}

function eligible(s: GameState, ev: GEvent): boolean {
  if (s.fired.includes(ev.id)) return false;
  if (ev.at[0] !== s.year || ev.at[1] !== s.month) return false;
  if (ev.cond && !ev.cond(s)) return false;
  return true;
}

// ───────── Начало месяца ─────────
function genMonth(s: GameState) {
  s.queue = [];
  const datedHistory = REAL_EVENTS.filter((event) => eligible(s, event));
  for (const event of datedHistory) { s.queue.push(event.id); s.fired.push(event.id); }
  // законопроекты
  if (s.billTried.length && s.month === 1) s.billTried = [];
  const el = BILLS.filter((b) => s.year >= b.y1 && s.year <= b.y2 && !s.passed.includes(b.id) && !s.billTried.includes(b.id));
  s.billOffer = el.sort(() => Math.random() - 0.5).slice(0, 4).map((b) => b.id);
  // председатель
  if (s.year === 2008 && s.month === 4 && s.chair === "gryzlov") s.chair = "putin";
  if (s.year === 2012 && s.month === 5 && s.chair === "putin") s.chair = "medvedev";
  // выборы и съезды
  const elc = ELECTIONS.find((e) => e.y === s.year && e.m === s.month);
  const cg = CONGRESSES.find((c) => c.y === s.year && c.m === s.month);
  s.pending = null;
  if (elc) s.pending = { type: "election", id: elc.id };
  else if (cg) s.pending = { type: "congress", id: `${cg.y}-${cg.m}` };
  s.chosenToday = 0;
}

function monthlyDynamics(s: GameState) {
  const d = DIFF_BY_ID[s.diff];
  const st = s.st;
  // нефть
  const base = OIL_BY_YEAR[s.year] ?? 65;
  s.oil = Math.max(15, base + rnd(-6, 6));
  const oilEff = (s.oil - 60) / 60;
  const rent = s.eco === "eco_rent" ? 2 : 1;
  const nextSub = SUB_BY_ID[s.sub];
  // дрейфы к равновесию (равновесие сдвигают структурные реформы)
  const g = (k: string) => s.mods[k] ?? 0;
  st.ec += (47 + oilEff * 9 * rent - (st.co - 60) * 0.25 + g("ec") - st.ec) * 0.03;
  st.fd += 8 + oilEff * 3 * rent + s.seats * 0.04 - 2.5;
  st.lv += (18 + 0.5 * st.ec + oilEff * 4 + g("lv") - st.lv) * 0.03;
  st.stb += (28 + 0.3 * st.un + 0.2 * st.lv + 0.08 * st.ap + g("stb") - st.stb) * 0.035;
  const apT = 0.28 * st.lv + 0.2 * st.stb + 0.2 * st.ec + 0.1 * st.pr + 0.1 * st.un + 0.1 * st.fr - (st.co - 60) * 0.15 + 2 + g("ap");
  st.ap += (apT - st.ap) * 0.07;
  st.pr += (48 + g("pr") + oilEff * 2 - st.pr) * 0.03;
  st.un += (58 + g("un") - st.un) * 0.03;
  st.co += (62 + g("co") - st.co) * 0.015;
  st.ml += (40 + g("ml") - st.ml) * 0.02;
  st.fr += (45 + g("fr") - st.fr) * 0.01;
  st.pc = Math.min(100, st.pc + d.pcRegen);
  // системные эффекты
  for (const e of [ALL_SYS[s.eco]?.e, ALL_SYS[s.gov]?.e, ALL_SYS[s.par]?.e, nextSub?.e, BUDGETS.find((b) => b.id === s.budget)?.e]) if (e) applyEff(s, e, true);
  // министерства
  for (const m of MINISTRIES) {
    const holder = s.cabinet[m.id];
    const fit = m.fit.includes(holder);
    const sign = m.stat === "co" ? -1 : 1;
    applyEff(s, { [m.stat]: (fit ? 0.03 : -0.01) * sign } as Eff, true);
  }
  // идеология — медленный дрейф к основной
  s.ide[s.mainIde] = (s.ide[s.mainIde] ?? 0) + 0.15; normIde(s);
  // фракции
  const avgLoy = FACTIONS.reduce((a, f) => a + s.facLoy[f.id] * s.fac[f.id], 0) / FACTIONS.reduce((a, f) => a + s.fac[f.id], 0);
  for (const f of FACTIONS) {
    s.fac[f.id] = clamp(s.fac[f.id] + rnd(-0.25, 0.25), 1, 60);
    const align = (s.ide[f.ide] ?? 10) * 0.4 + 50;
    s.facLoy[f.id] = clamp(s.facLoy[f.id] + (align - s.facLoy[f.id]) * 0.02 + rnd(-0.6, 0.6), 0, 100);
  }
  st.un += (avgLoy - 55) * 0.012;
  // партийцы, включая созданного игроком деятеля
  for (const m of [...MEMBERS, ...(s.customMembers ?? [])]) {
    const ms = s.mem[m.id];
    if (!ms) continue;
    if (ms.cd > 0) ms.cd--;
    ms.loy = clamp(ms.loy + (60 - ms.loy) * 0.01 + rnd(-0.4, 0.4), 0, 100);
  }
  // соперники
  const pressure = Object.entries(s.org).reduce((a, [, o]) => a + (o.status === "active" ? o.p : 0), 0) * 0.0012;
  st.ap -= pressure * (1 + (50 - st.fr) / 100);
  for (const r of RIVALS) {
    const rs = s.riv[r.id];
    if (!rs.alive) {
      if (rs.r < 0 && s.month === 1 && s.year >= r.from && s.year <= r.to) {
        rs.alive = true; rs.r = r.r * 0.8;
        s.log.unshift(`${dateStr(s)}: появилась партия «${r.name}»`);
      }
      continue;
    }
    let drift = rnd(-0.25, 0.25) + (50 - st.ap) * 0.004 * d.rivalBoost + (r.r - rs.r) * 0.012;
    if (r.kind === "lib") drift += st.fr < 35 ? 0.04 : -0.01;
    if (r.kind === "left") drift += st.lv < 40 ? 0.05 : 0;
    if (r.kind === "nat") drift += st.pr < 40 ? 0.05 : 0;
    rs.r = clamp(rs.r + drift, 0.2, 35);
    if (r.to < 9999 && (s.year > r.to || (s.year === r.to && s.month === 12))) {
      rs.alive = false; rs.r = 0; rs.note = "распущена или слита";
      s.log.unshift(`${dateStr(s)}: партия «${r.name}» прекратила существование`);
    }
  }
  // Организации и партии появляются и прекращают работу по указанным в каталоге годам.
  for (const o of ORGS) {
    const os = s.org[o.id];
    if (os.status === "pending") {
      if (s.month === 1 && s.year >= o.from) { os.status = "active"; os.p = o.p; s.log.unshift(`${dateStr(s)}: появилась организация «${o.name}»`); }
      continue;
    }
    if (os.status !== "active" && os.status !== "coopted") continue;
    os.p = clamp(os.p + rnd(-0.6, 0.6) + (st.fr < 35 && os.status === "active" ? -0.1 : 0) + (st.stb < 35 ? 0.1 : 0), 0, 100);
    if (o.to < 9999 && (s.year > o.to || (s.year === o.to && s.month === 12))) {
      os.status = "dissolved"; os.note = o.fate;
      s.log.unshift(`${dateStr(s)}: «${o.name}» — ${o.fate}`);
    }
    if (os.p <= 0.5 && os.status !== "dissolved") { os.status = "dissolved"; os.note = "угасла"; }
  }
  // фокусы
  for (const t of ["eco", "pol", "army", "dip"] as TreeId[]) {
    const ft = s.focus[t];
    if (!ft.cur) continue;
    ft.left--;
    if (ft.left <= 0) {
      const node = FOCUS_BY_ID[ft.cur];
      ft.done.push(ft.cur);
      ft.cur = null;
      if (node) {
        applyEff(s, node.e);
        addMods(s, node.e, 0.35);
        s.log.unshift(`${dateStr(s)}: завершено решение «${node.name}»`);
      }
    }
  }
  // кламп
  for (const k of STAT_KEYS) {
    const key = k as StatKey;
    st[key] = clamp(st[key], 0, key === "fd" ? 99999 : 100);
  }
}

function checkEnd(s: GameState) {
  const d = DIFF_BY_ID[s.diff];
  if (s.over) return;
  if (d.over) {
    if (s.st.stb <= 3) s.over = { win: false, title: "Крах государства", text: "Стабильность упала до нуля: система власти рухнула, партия оказалась вне игры." };
    else if (s.st.un <= 3) s.over = { win: false, title: "Раскол партии", text: "Единство исчезло. Фракции разошлись по разным партиям, «партия власти» перестала существовать." };
    else if (s.st.ap <= 4) s.over = { win: false, title: "Рейтинг разрушен", text: "Партию не поддерживает никто. Отставка руководства и роспуск фракций неизбежны." };
  }
}

export function finalScore(s: GameState): number {
  const st = s.st;
  return Math.round(st.ap * 1.2 + st.stb + st.ec + st.lv + st.pr * 0.6 + st.un * 0.8 + (100 - st.co) * 0.5 + st.fr * 0.4 + s.seats * 0.5 + Math.min(st.fd, 500) * 0.05);
}

export function nextMonth(s0: GameState): GameState {
  const s = clone(s0);
  if (s.over) return s;
  monthlyDynamics(s);
  s.hist.push({ y: s.year, m: s.month, ap: Math.round(s.st.ap), ec: Math.round(s.st.ec) });
  checkEnd(s);
  if (s.over) return s;
  s.month++;
  if (s.month > 12) { s.month = 1; s.year++; }
  if (s.year > 2026) {
    s.year = 2026; s.month = 12;
    const sc = finalScore(s);
    s.over = {
      win: sc > 380,
      title: sc > 520 ? "Триумф партии" : sc > 380 ? "Устойчивое господство" : "Эпоха заканчивается",
      text: `Игра окончена: декабрь 2026. Итоговый счёт: ${sc}. Рейтинг ${Math.round(s.st.ap)}%, места в парламенте ${Math.round(s.seats)}%, стабильность ${Math.round(s.st.stb)}, единство ${Math.round(s.st.un)}.`,
    };
    return s;
  }
  genMonth(s);
  return s;
}

// ───────── Фокусы ─────────
export type FocusStatus = "done" | "active" | "available" | "locked" | "blocked" | "future";
export function focusStatus(s: GameState, n: FocusNode): FocusStatus {
  const ft = s.focus[n.tree];
  if (ft.done.includes(n.id)) return "done";
  if (ft.cur === n.id) return "active";
  if (n.excl?.some((x) => ft.done.includes(x) || ft.cur === x)) return "blocked";
  if (!n.pre.every((p) => ft.done.includes(p))) return "locked";
  if (n.any && !n.any.some((p) => ft.done.includes(p))) return "locked";
  if (n.y && s.year < n.y) return "future";
  return "available";
}

export function startFocus(s0: GameState, id: string): GameState {
  const n = FOCUS_BY_ID[id];
  if (!n) return s0;
  const s = clone(s0);
  const ft = s.focus[n.tree];
  if (focusStatus(s, n) !== "available" || ft.cur || s.st.pc < n.pc) return s0;
  s.st.pc -= n.pc;
  ft.cur = id;
  ft.left = n.cost;
  s.log.unshift(`${dateStr(s)}: запущено решение «${n.name}»`);
  return s;
}

export function cancelFocus(s0: GameState, tree: TreeId): GameState {
  const s = clone(s0);
  s.focus[tree].cur = null; s.focus[tree].left = 0;
  return s;
}

// ───────── Партийцы ─────────
export function membersFor(s: GameState): Member[] {
  return [...MEMBERS, ...(s.customMembers ?? [])];
}

export function memberActive(s: GameState, id: string) {
  const m = membersFor(s).find((x) => x.id === id);
  return !!m && s.year >= m.from && s.year <= m.to;
}

export interface CustomMemberInput {
  name: string;
  character: string;
  economy: string;
  sympathy: string;
  traits: string[];
}

export function createCustomMember(input: CustomMemberInput): Member {
  const effects: Record<string, Eff> = {
    "Рыночный прагматик": { ec: 2, fd: 10 },
    "Социальный государственник": { lv: 2, fd: -10 },
    "Плановый модернизатор": { ec: -1, lv: 2, ml: 1 },
    "Государственный индустриалист": { ec: 1, stb: 1, ml: 1 },
  };
  const characterEffects: Record<string, Eff> = {
    "Дипломат": { pr: 1 }, "Организатор": { un: 1 }, "Технократ": { ec: 1, co: -1 },
    "Популист": { ap: 1, un: -1 }, "Силовик": { ml: 1, fr: -1 },
  };
  const traitEffects: Record<string, Eff> = {
    "переговорщик": { pr: 0.5 }, "реформатор": { ec: 0.5, "f.mod": 0.5 }, "антикоррупционер": { co: -0.5 },
    "патриот": { un: 0.5 }, "организатор": { un: 0.5 }, "социальный лидер": { lv: 0.5, "f.soc": 0.5 },
    "цифровизатор": { ec: 0.5, co: -0.25 }, "популярный оратор": { ap: 0.5 },
  };
  const name = input.name.trim().slice(0, 48) || "Новый партийный деятель";
  const sympathy = input.sympathy in FAC_START ? input.sympathy : "mod";
  const e: Eff = { ...(effects[input.economy] ?? effects["Рыночный прагматик"]), ...(characterEffects[input.character] ?? {}), [`f.${sympathy}`]: 1 };
  for (const trait of input.traits.slice(0, 4)) {
    for (const [key, value] of Object.entries(traitEffects[trait] ?? {})) e[key] = (typeof e[key] === "number" ? e[key] as number : 0) + (value as number);
  }
  return {
    id: "custom_player", name, role: "Созданный партийный деятель", fac: sympathy,
    from: 2003, to: 2026, loy: 65, inf: 55,
    dec: "Инициатива собственного профиля", decText: `Курс: ${input.character}; экономика: ${input.economy}.`,
    e, pc: 5, cd: 8, bio: "Персонаж создан игроком перед началом кампании.",
    positions: { character: input.character, economy: input.economy, sympathy, traits: input.traits.slice(0, 4) }, custom: true,
  };
}

export function useMember(s0: GameState, id: string): GameState {
  const m = membersFor(s0).find((x) => x.id === id);
  if (!m) return s0;
  const s = clone(s0);
  const ms = s.mem[id];
  if (!ms || !memberActive(s, id) || ms.cd > 0 || ms.loy < 20 || s.st.pc < m.pc) return s0;
  s.st.pc -= m.pc;
  const k = 0.5 + ms.loy / 100;
  const e: Eff = {};
  for (const [key, v] of Object.entries(m.e)) e[key] = typeof v === "number" ? Math.round(v * k * 10) / 10 : v;
  applyEff(s, e);
  ms.cd = m.cd; ms.used++; ms.loy = clamp(ms.loy + 2, 0, 100);
  s.log.unshift(`${dateStr(s)}: решение партийца — ${m.name}: «${m.dec}»`);
  return s;
}

// ───────── Правительство ─────────
export function billSupport(s: GameState, billId: string) {
  const b = BILLS.find((x) => x.id === billId)!;
  const par = PARLIAMENTS.find((p) => p.id === s.par) ?? PARLIAMENTS[0];
  return { support: govSupport(s, par, b.diff), need: b.cons ? 66.7 : 50 };
}
export function passBill(s0: GameState, billId: string): { s: GameState; ok: boolean; support: number } {
  const b = BILLS.find((x) => x.id === billId);
  if (!b || s0.st.pc < 3) return { s: s0, ok: false, support: 0 };
  const s = clone(s0);
  s.st.pc -= 3;
  const { support, need } = billSupport(s, billId);
  const noisy = support + rnd(-6, 6);
  const ok = noisy >= need;
  if (ok) {
    applyEff(s, b.e);
    addMods(s, b.e, 0.25);
    s.passed.push(b.id);
    s.log.unshift(`${dateStr(s)}: Дума приняла «${b.title}» (${Math.round(noisy)}% голосов)`);
  } else {
    s.st.un = clamp(s.st.un - 1, 0, 100);
    s.billTried.push(b.id);
    s.log.unshift(`${dateStr(s)}: законопроект «${b.title}» провален (${Math.round(noisy)}%)`);
  }
  s.billOffer = s.billOffer.filter((x) => x !== b.id);
  return { s, ok, support: noisy };
}
export function reassignMinistry(s0: GameState, mid: string, fac: string): GameState {
  const m = MINISTRIES.find((x) => x.id === mid);
  if (!m || s0.cabinet[mid] === fac || s0.st.pc < 8) return s0;
  const s = clone(s0);
  s.st.pc -= 8;
  const prev = s.cabinet[mid];
  s.cabinet[mid] = fac;
  applyEff(s, { [`f.${fac}`]: 3, [`l.${fac}`]: 5, [`l.${prev}`]: -4, [`f.${prev}`]: -1 });
  const sign = m.stat === "co" ? -1 : 1;
  applyEff(s, { [m.stat]: (m.fit.includes(fac) ? 2 : -1) * sign } as Eff);
  s.log.unshift(`${dateStr(s)}: ${m.name} передано фракции «${FACTIONS.find((f) => f.id === fac)?.name}»`);
  return s;
}
export function setBudget(s0: GameState, id: string): GameState {
  if (s0.budget === id || s0.st.pc < 3) return s0;
  const s = clone(s0);
  s.st.pc -= 3; s.budget = id;
  s.log.unshift(`${dateStr(s)}: курс бюджета — «${BUDGETS.find((b) => b.id === id)?.name}»`);
  return s;
}

// ───────── Организации и соперники ─────────
export function orgAction(s0: GameState, id: string, act: "coopt" | "ban" | "fund" | "pressure"): GameState {
  const s = clone(s0);
  const o = s.org[id];
  if (!o || (o.status !== "active" && o.status !== "coopted")) return s0;
  const info = orgInfo(s, id);
  if (act === "coopt") {
    if (s.st.pc < 4 || o.status === "coopted") return s0;
    s.st.pc -= 4; o.status = "coopted"; o.p *= 0.8;
    applyEff(s, { stb: 1, fr: -1, ap: 1 });
    s.log.unshift(`${dateStr(s)}: «${info.name}» кооптирована в систему`);
  } else if (act === "ban") {
    if (s.st.pc < 6) return s0;
    s.st.pc -= 6; o.status = "banned"; o.note = "запрещена вами";
    applyEff(s, { fr: -3, stb: 1, "f.sil": 1 });
    s.log.unshift(`${dateStr(s)}: «${info.name}» запрещена`);
  } else if (act === "fund") {
    if (s.st.fd < 30) return s0;
    s.st.fd -= 30; o.p = clamp(o.p + 6, 0, 100);
    applyEff(s, { ap: 0.5 });
    s.log.unshift(`${dateStr(s)}: профинансирована «${info.name}»`);
  } else {
    if (s.st.pc < 2) return s0;
    s.st.pc -= 2; o.p = clamp(o.p - 5, 0, 100);
    applyEff(s, { fr: -1 });
    if (o.p <= 0.5) { o.status = "dissolved"; o.note = "задавлена"; }
    s.log.unshift(`${dateStr(s)}: давление на «${info.name}»`);
  }
  return s;
}
export function rivalAction(s0: GameState, id: string, act: "boost" | "crush" | "ban"): GameState {
  const s = clone(s0);
  const r = s.riv[id];
  if (!r || !r.alive) return s0;
  const info = RIVALS.find((x) => x.id === id)!;
  if (act === "boost") {
    if (s.st.pc < 3) return s0;
    s.st.pc -= 3; r.r = clamp(r.r + 1.5, 0.2, 40); applyEff(s, { fr: 1, ap: -0.5 });
  } else if (act === "crush") {
    if (s.st.pc < 3) return s0;
    s.st.pc -= 3; r.r = clamp(r.r - 1.5, 0.2, 40); applyEff(s, { fr: -1, ap: 0.5, fd: -10 });
  } else {
    if (s.st.pc < 10) return s0;
    s.st.pc -= 10; r.alive = false; r.r = 0; r.note = "запрещена"; applyEff(s, { fr: -5, stb: -1, pr: -2 });
    s.log.unshift(`${dateStr(s)}: партия «${info.name}» запрещена`);
  }
  return s;
}

// ───────── Съезды ─────────
export function congressThreshold(s: GameState) {
  return { sandbox: 32, easy: 40, medium: 46, hard: 52, realism: 58 }[s.diff];
}
export function subSupport(s: GameState, subId: string, boost = 0): number {
  const sub = SUB_BY_ID[subId];
  if (!sub) return 0;
  const tot = FACTIONS.reduce((a, f) => a + s.fac[f.id], 0);
  let sup = 0;
  for (const f of FACTIONS) {
    const aff = sub.fav.includes(f.id) ? 1 : f.ide === sub.ide ? 0.55 : 0.2;
    sup += (s.fac[f.id] / tot) * (s.facLoy[f.id] / 100) * aff * 100;
  }
  sup += ((s.ide[sub.ide] ?? 5) - 11) * 0.35;
  sup += (s.st.un - 50) * 0.08;
  if (subId === s.sub) sup = Math.max(sup, 100);
  return clamp(sup + boost, 0, 100);
}
export function adoptSub(s0: GameState, subId: string, boost: number): { s: GameState; ok: boolean; support: number } {
  const s = clone(s0);
  const sub = SUB_BY_ID[subId];
  const support = subSupport(s, subId, boost) + rnd(-2, 2);
  const ok = support >= congressThreshold(s);
  if (ok) {
    s.sub = subId; s.mainIde = sub.ide;
    applyEff(s, { [`i.${sub.ide}`]: 8, un: -1 });
    for (const f of FACTIONS) applyEff(s, { [`l.${f.id}`]: sub.fav.includes(f.id) ? 4 : -2 });
    s.log.unshift(`${dateStr(s)}: съезд принял идеологию «${sub.name}» (${Math.round(support)}%)`);
  } else {
    applyEff(s, { un: -3, pc: -5 });
    for (const f of FACTIONS) if (sub.fav.includes(f.id)) applyEff(s, { [`l.${f.id}`]: -3 });
    s.log.unshift(`${dateStr(s)}: съезд отверг «${sub.name}» (${Math.round(support)}%)`);
  }
  s.pending = null;
  return { s, ok, support };
}
export function lobbyCost(boostSteps: number) { return 4 + boostSteps * 2; }
export function closeCongress(s0: GameState): GameState {
  const s = clone(s0);
  s.pending = null;
  applyEff(s, { un: 1 });
  return s;
}
export function callExtraCongress(s0: GameState): GameState {
  if (s0.st.pc < 25 || s0.pending || (s0.flags.extraCg ?? 0) > s0.year * 12 + s0.month - 12) return s0;
  const s = clone(s0);
  s.st.pc -= 25;
  s.flags.extraCg = s.year * 12 + s.month;
  s.pending = { type: "congress", id: "extra" };
  return s;
}

// ───────── Выборы ─────────
export interface Strat { id: string; name: string; desc: string; cost: number; bonus: number; fraud: number; fx: Eff }
export const STRATS: Strat[] = [
  { id: "fair", name: "Честная кампания", desc: "Открытая борьба без вмешательства. Уважение, но риск.", cost: 20, bonus: 0, fraud: 0, fx: { fr: 2, pr: 1 } },
  { id: "std", name: "Стандартная кампания", desc: "Агитация, телевидение, умеренный админресурс.", cost: 40, bonus: 2, fraud: 1, fx: {} },
  { id: "pop", name: "Щедрая социальная кампания", desc: "Обещания и выплаты накануне голосования.", cost: 120, bonus: 4, fraud: 1, fx: { lv: 1, ap: 1 } },
  { id: "admin", name: "Административный ресурс", desc: "Давление на бюджетников и «карусели».", cost: 60, bonus: 3, fraud: 6, fx: { fr: -3, co: 2 } },
  { id: "total", name: "Тотальный контроль", desc: "Фальсификации в промышленных масштабах. Риск протестов.", cost: 100, bonus: 5, fraud: 14, fx: { fr: -8, co: 4, stb: -2 } },
];

export function electionCandidates(s: GameState, type: "duma" | "pres"): { c: Candidate; ok: boolean; why?: string }[] {
  return CANDIDATES.filter((c) => s.year >= c.from && s.year <= c.to + 2).map((c) => {
    let ok = true; let why: string | undefined;
    if (type === "pres" && c.id === s.president && (s.flags.consec ?? 0) >= 2 && !s.flags.no_term_limit) {
      ok = false; why = "Не более двух сроков подряд";
    }
    return { c, ok, why };
  });
}

export interface ElectionReport {
  title: string; win: boolean; lines: string[]; table: { name: string; share: number; pass: boolean; us?: boolean }[];
  seats?: number; protest?: boolean;
}

export function runElection(s0: GameState, elId: string, candId: string, stratId: string): { s: GameState; report: ElectionReport } {
  const s = clone(s0);
  const el = ELECTIONS.find((e) => e.id === elId)!;
  const cand = CANDIDATES.find((c) => c.id === candId) ?? CANDIDATES[0];
  const strat = STRATS.find((x) => x.id === stratId) ?? STRATS[1];
  const d = DIFF_BY_ID[s.diff];
  const par = PARLIAMENTS.find((p) => p.id === s.par) ?? PARLIAMENTS[0];
  const paid = Math.min(strat.cost, s.st.fd);
  s.st.fd -= paid;
  const efficiency = paid / strat.cost;
  const bonus = strat.bonus * efficiency;
  const pres = el.type === "pres";
  const noise = rnd(-3, 3) * (s.diff === "realism" ? 1.4 : 1);
  const real = clamp(pres ? 8 + 0.45 * s.st.ap + 0.35 * cand.ch + 0.1 * s.st.stb + bonus + noise : s.st.ap * 0.95 + (cand.ch - 50) * 0.12 + bonus + noise, 5, 92);
  const fraud = strat.fraud * efficiency;
  const official = clamp(real + fraud, 5, 96);
  applyEff(s, strat.fx);
  const alive = RIVALS.filter((r) => s.riv[r.id].alive);
  const rest = Math.max(4, 100 - official - 3);
  const w = alive.map((r) => ({ r, w: s.riv[r.id].r * rnd(0.85, 1.15) }));
  const sw = w.reduce((a, x) => a + x.w, 0) || 1;
  const table = [{ name: pres ? cand.name : "Единая Россия", share: official, pass: true, us: true }, ...w.map((x) => ({ name: x.r.name, share: (rest * x.w) / sw, pass: pres ? true : (rest * x.w) / sw >= par.thr! }))];
  table.sort((a, b) => b.share - a.share);
  const lines: string[] = [];
  const report: ElectionReport = { title: el.title, win: true, lines, table: table.slice(0, 8) };
  lines.push(`Реальная поддержка: ≈${real.toFixed(1)}%. Официальный результат: ${official.toFixed(1)}%.`);
  if (paid < strat.cost) lines.push("Не хватило денег в кассе — кампания проведена урезанно.");
  if (pres) {
    const winNow = official > 50;
    let win = winNow;
    if (!winNow && official > 38) {
      win = Math.random() < (official - 30) / 25;
      lines.push(win ? "Потребовался второй тур — победа." : "Второй тур — поражение.");
    }
    report.win = win;
    if (win) {
      s.president = cand.id;
      s.flags.consec = s.president === s0.president ? (s.flags.consec ?? 0) + 1 : 1;
      applyEff(s, cand.e);
      applyEff(s, { ap: (official - 50) * 0.04, un: 1 });
      lines.push(`${cand.name} избран президентом.`);
      s.log.unshift(`${dateStr(s)}: ${el.title}: победа — ${cand.name} (${official.toFixed(1)}%)`);
    } else {
      lines.push("Кандидат партии проиграл президентские выборы.");
      s.log.unshift(`${dateStr(s)}: ${el.title}: поражение (${official.toFixed(1)}%)`);
      applyEff(s, { ap: -10, un: -6, stb: -6 });
      if (d.over) s.over = { win: false, title: "Поражение на президентских выборах", text: "Ваш кандидат не получил поддержки, власть перешла к оппозиции. Партия утратила монополию на власть." };
    }
  } else {
    const passing = table.filter((x) => x.pass);
    const totalPass = passing.reduce((a, x) => a + x.share, 0) || 1;
    const bonusSeats = par.bonus! * (official > 35 ? 1 : 0.5) * (s.diff === "realism" ? 0.7 : 1);
    const seats = clamp((official / totalPass) * 100 + bonusSeats, 0, 100);
    s.seats = seats;
    report.seats = seats;
    report.win = seats >= 50;
    lines.push(`Мандатов в парламенте: ≈${seats.toFixed(1)}%${seats >= 66.7 ? " — конституционное большинство" : seats >= 50 ? " — простое большинство" : " — большинство потеряно"}.`);
    if (cand.e) {
      const half: Eff = {};
      for (const [k, v] of Object.entries(cand.e)) if (typeof v === "number") half[k] = Math.round(v * 0.5 * 10) / 10;
      applyEff(s, half);
    }
    applyEff(s, { ap: (official - s.st.ap) * 0.1, un: seats >= 50 ? 1 : -4 });
    s.log.unshift(`${dateStr(s)}: ${el.title}: ${official.toFixed(1)}%, ${seats.toFixed(0)}% мест`);
  }
  // протесты после фальсификаций
  const protestP = Math.min(0.9, fraud * 0.035 * d.fraudRisk * (1 + (50 - s.st.fr) / 150));
  if (fraud >= 3 && Math.random() < protestP) {
    report.protest = true;
    lines.push("Массовые протесты против фальсификаций!");
    applyEff(s, { ap: -3, stb: -3, fr: -1, "o.fbk": 4, "o.solidarnost": 4 });
    s.log.unshift(`${dateStr(s)}: протесты после выборов`);
  }
  s.pending = null;
  return { s, report };
}

export function facShares(s: GameState) {
  const tot = FACTIONS.reduce((a, f) => a + s.fac[f.id], 0);
  return FACTIONS.map((f) => ({ f, share: (s.fac[f.id] / tot) * 100, loy: s.facLoy[f.id], leader: leaderOf(f.id, s.year) }));
}

export function ideShares(s: GameState) {
  return IDEOLOGIES.map((i) => ({ i, w: s.ide[i.id] ?? 0 })).sort((a, b) => b.w - a.w);
}

export { SUBS };
export const FOCUS_LIST = FOCUS;
