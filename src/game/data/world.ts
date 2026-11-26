import mapData from "./world-map.json";

export interface WorldCountry {
  id: string;
  numericId: string;
  iso3: string;
  name: string;
  nameRu: string;
  flag: string;
  region: string;
  subregion: string;
  capital: string;
  path: string;
}

export const WORLD_COUNTRIES = mapData as WorldCountry[];
export const COUNTRY_BY_ID: Record<string, WorldCountry> = Object.fromEntries(WORLD_COUNTRIES.map((country) => [country.id, country]));
