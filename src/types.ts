export type Pool = "allTime" | "active";
export type Mode = "allTime" | "activeEasy" | "activeHard";

export interface Player {
  id: number;
  name: string;
  position: string;
  seasons: SeasonStint[];
  pools: Pool[];
  careerPoints: number;
  careerWins?: number;
  birthCountry: string;
}

export interface SeasonStint {
  season: string;
  team: string;
  gamesPlayed: number;
  stintOrder?: number;
}
