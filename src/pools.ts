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
      const skaters = active
        .filter((p) => p.position !== "G")
        .sort((a, b) => b.careerPoints - a.careerPoints);
      const goalies = active
        .filter((p) => p.position === "G")
        .sort((a, b) => (b.careerWins ?? 0) - (a.careerWins ?? 0));
      // Interleave by within-position percentile so the easy pool matches the
      // active pool's skater/goalie composition instead of dropping goalies
      // (who have ~0 career points).
      const ranked: Array<{ p: Player; pct: number }> = [
        ...skaters.map((p, i) => ({ p, pct: i / Math.max(skaters.length, 1) })),
        ...goalies.map((p, i) => ({ p, pct: i / Math.max(goalies.length, 1) })),
      ];
      return ranked
        .sort((a, b) => a.pct - b.pct)
        .slice(0, ACTIVE_EASY_SIZE)
        .map((x) => x.p);
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
