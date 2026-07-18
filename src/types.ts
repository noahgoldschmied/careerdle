export interface Player {
  id: number;
  name: string;
  position: string;
  seasons: SeasonStint[];
}

export interface SeasonStint {
  season: string;
  team: string;
  gamesPlayed: number;
  stintOrder?: number;
}
