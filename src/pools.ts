import type { Mode, Player } from "./types.ts";

const ACTIVE_EASY_SIZE = 300;

export function derivePool(players: Player[], mode: Mode): Player[] {
  switch (mode) {
    case "allTime":
      return players.filter((p) => p.pools.includes("allTime"));
    case "activeHard":
      return players.filter((p) => p.pools.includes("active"));
    case "activeEasy": {
      const active = players.filter((p) => p.pools.includes("active"));
      return [...active]
        .sort((a, b) => b.careerPoints - a.careerPoints)
        .slice(0, ACTIVE_EASY_SIZE);
    }
  }
}

export function poolLabel(mode: Mode): string {
  switch (mode) {
    case "allTime":
      return "All-time top scorers";
    case "activeEasy":
      return "Active — Easy";
    case "activeHard":
      return "Active — Hard";
  }
}
