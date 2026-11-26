// Общие типы симулятора «Единая Россия: 2003–2026»

export type StatKey = "ap" | "pc" | "fd" | "un" | "stb" | "ec" | "lv" | "ml" | "pr" | "fr" | "co";

/**
 * Эффекты. Ключи:
 *  ap,pc,fd,un,stb,ec,lv,ml,pr,fr,co — показатели
 *  f.<id> — влияние фракции, l.<id> — лояльность фракции
 *  m.<id> — лояльность партийца, r.<id> — рейтинг соперника, o.<id> — сила организации
 *  i.<id> — вес идеологии, seat — доля мест
 *  eco / gov / par — смена типа экономики/госустройства/парламента (строка)
 *  flag.<name> — поставить флаг, unflag.<name> — снять флаг
 */
export type Eff = Record<string, number | string>;

export type DiffId = "sandbox" | "easy" | "medium" | "hard" | "realism";

export interface Opt {
  t: string; // текст варианта
  e: Eff; // эффекты
  r?: string; // текст результата
  c?: number; // стоимость в политкапитале
  req?: (s: GameState) => boolean;
  reqText?: string;
}

export interface GEvent {
  id: string;
  cat: string;
  title: string;
  text: string;
  opts: Opt[];
  at: [number, number]; // точная историческая дата [год, месяц]
  cond?: (s: GameState) => boolean;
  hist: true;
}

export interface FocusNode {
  id: string;
  tree: TreeId;
  name: string;
  desc: string;
  pre: string[]; // все обязательные
  any?: string[]; // хотя бы один
  excl?: string[]; // взаимоисключающие
  cost: number; // месяцев
  pc: number; // цена в политкапитале
  e: Eff;
  y?: number; // не раньше года
  crazy?: boolean;
  req?: (s: GameState) => boolean;
  reqText?: string;
}

export type TreeId = "eco" | "pol" | "army" | "dip";

export interface Faction {
  id: string;
  name: string;
  color: string;
  desc: string;
  leaders: [number, string][]; // с какого года кто лидер
  ide: string; // основная идеология
}

export interface MemberPositions {
  character: string;
  economy: string;
  sympathy: string;
  traits: string[];
}

export interface Member {
  id: string;
  name: string;
  role: string;
  fac: string;
  from: number;
  to: number;
  loy: number;
  inf: number;
  dec: string;
  decText: string;
  e: Eff;
  pc: number;
  cd: number;
  bio: string;
  positions: MemberPositions;
  custom?: boolean;
}

export interface Rival {
  id: string;
  name: string;
  leader: string;
  ide: string;
  r: number;
  from: number;
  to: number;
  kind: "parl" | "lib" | "left" | "nat" | "other";
}

export interface Org {
  id: string;
  name: string;
  leader: string;
  ide: string;
  p: number;
  from: number;
  to: number; // реальный год роспуска/запрета (9999 = существует)
  fate: string;
}

export interface OrgState {
  p: number;
  status: "pending" | "active" | "dissolved" | "banned" | "coopted";
  note?: string;
  name?: string;
  leader?: string;
  ide?: string;
}

export interface FocusTreeState {
  done: string[];
  cur: string | null;
  left: number;
}

export interface MemberState {
  loy: number;
  cd: number;
  used: number;
}

export interface CampaignFactionOutcome {
  government: string;
  leader: string;
  ideology: string;
  summary: string;
  effects?: Eff;
}

export interface CampaignFaction {
  id: string;
  name: string;
  leader: string;
  profile: string;
  outcome: CampaignFactionOutcome;
}

export interface CampaignSide {
  id: string;
  name: string;
  description: string;
  factions: CampaignFaction[];
}

export interface CampaignScenario {
  id: string;
  kind: "war" | "political";
  title: string;
  countryId: string;
  region?: string;
  years: [number, number];
  background: string;
  historicalResult: string;
  historicalWinner: { sideId: string; factionId: string };
  sides: CampaignSide[];
}

export interface CampaignResult extends CampaignFactionOutcome {
  sideId: string;
  factionId: string;
  sideName: string;
  factionName: string;
  historical: boolean;
  date: string;
}

export interface CampaignProgress {
  sideId: string | null;
  factionId: string | null;
  support: number;
  operations: number;
  status: "open" | "resolved";
  result: CampaignResult | null;
}

export interface CountrySettlement {
  scenarioId: string;
  government: string;
  leader: string;
  ideology: string;
  summary: string;
}

export interface GameState {
  v: number;
  diff: DiffId;
  year: number;
  month: number;
  st: Record<StatKey, number>;
  oil: number;
  ide: Record<string, number>;
  mainIde: string;
  sub: string;
  fac: Record<string, number>;
  facLoy: Record<string, number>;
  mem: Record<string, MemberState>;
  customMembers: Member[];
  playAs: string;
  partyName: string;
  riv: Record<string, { r: number; alive: boolean; note?: string }>;
  budget: string;
  mods: Record<string, number>;
  org: Record<string, OrgState>;
  eco: string;
  gov: string;
  par: string;
  focus: Record<TreeId, FocusTreeState>;
  flags: Record<string, number>;
  fired: string[];
  queue: string[];
  cabinet: Record<string, string>;
  passed: string[];
  billOffer: string[];
  billTried: string[];
  seats: number; // % мест в нижней палате
  president: string;
  chair: string;
  campaigns: Record<string, CampaignProgress>;
  relations: Record<string, number>;
  settlements: Record<string, CountrySettlement>;
  log: string[];
  pending: { type: "election" | "congress"; id: string } | null;
  over: null | { win: boolean; title: string; text: string };
  chosenToday: number;
  hist: { y: number; m: number; ap: number; ec: number }[];
}
