import type { SeasonStint } from "./types.ts";

export interface DisplayChip {
  team: string;
  startYear: number;
  endYear: number;
  midSeasonTrade: boolean;
  joinedMidSeason: boolean;
  leftMidSeason: boolean;
}

export function seasonStartYear(season: string): number {
  return Number(season.slice(0, 4));
}
export function seasonEndYear(season: string): number {
  return Number(season.slice(4, 8));
}

export function collapseArc(stints: SeasonStint[]): DisplayChip[] {
  const chips: DisplayChip[] = [];
  for (let i = 0; i < stints.length; i++) {
    const stint = stints[i];
    const startY = seasonStartYear(stint.season);
    const endY = seasonEndYear(stint.season);
    const isTrade = stint.stintOrder !== undefined;
    // A stint "arrived" if the previous stint is a different team in the same season
    // (player was traded in). "Departed" if the next stint is a different team in the
    // same season (player was traded out).
    const prev = i > 0 ? stints[i - 1] : undefined;
    const next = i + 1 < stints.length ? stints[i + 1] : undefined;
    const arrived = isTrade && prev !== undefined && prev.season === stint.season && prev.team !== stint.team;
    const departed = isTrade && next !== undefined && next.season === stint.season && next.team !== stint.team;

    const last = chips.at(-1);
    if (last !== undefined && last.team === stint.team) {
      last.startYear = Math.min(last.startYear, startY);
      last.endYear = Math.max(last.endYear, endY);
      last.midSeasonTrade = last.midSeasonTrade || isTrade;
      last.leftMidSeason = departed;
    } else {
      chips.push({
        team: stint.team,
        startYear: startY,
        endYear: endY,
        midSeasonTrade: isTrade,
        joinedMidSeason: arrived,
        leftMidSeason: departed,
      });
    }
  }
  return chips;
}

export function arcSignature(stints: SeasonStint[]): string {
  return collapseArc(stints)
    .map((c) => `${c.team}|${c.startYear}|${c.endYear}|${c.joinedMidSeason ? 1 : 0}|${c.leftMidSeason ? 1 : 0}`)
    .join(";");
}

// An arc is "distinctive" enough to be worth calling out shared-career-arc
// twins for: multi-team, or a single-team stint spanning 3+ full seasons.
// Rookie stubs (one team, one season) match too easily to be meaningful even
// when their signatures coincide.
export function isDistinctiveArc(stints: SeasonStint[]): boolean {
  const chips = collapseArc(stints);
  if (chips.length !== 1) return chips.length >= 2;
  const only = chips[0];
  return only.endYear - only.startYear >= 3;
}
