import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Player, SeasonStint } from "../src/types.ts";

const POOL_SIZE = 500;
const PAGE_SIZE = 100;
const CONCURRENCY = 4;
const MAX_RETRIES = 5;
const OUT_PATH = new URL("../public/data/players.json", import.meta.url);

interface TeamRow {
  fullName: string;
  triCode: string;
}

interface SkaterRow {
  playerId: number;
  skaterFullName: string;
  positionCode: string;
  gamesPlayed: number;
}

interface LandingSeason {
  season: number;
  gameTypeId: number;
  leagueAbbrev: string;
  gamesPlayed: number;
  teamName: { default: string };
}

interface LandingResponse {
  seasonTotals: LandingSeason[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    // Retry on rate limits and transient 5xx.
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt >= MAX_RETRIES) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 500 * 2 ** attempt + Math.floor(Math.random() * 250);
    await sleep(backoff);
    attempt++;
  }
}

async function fetchTeamMap(): Promise<Map<string, string>> {
  const res = await fetchJson<{ data: TeamRow[] }>(
    "https://api.nhle.com/stats/rest/en/team",
  );
  const map = new Map<string, string>();
  for (const t of res.data) map.set(t.fullName, t.triCode);
  return map;
}

async function fetchPlayerPool(total: number): Promise<SkaterRow[]> {
  const sort = encodeURIComponent(
    JSON.stringify([{ property: "gamesPlayed", direction: "DESC" }]),
  );
  const all: SkaterRow[] = [];
  for (let start = 0; start < total; start += PAGE_SIZE) {
    const url =
      `https://api.nhle.com/stats/rest/en/skater/summary` +
      `?limit=${PAGE_SIZE}&start=${start}&sort=${sort}` +
      `&cayenneExp=gameTypeId=2&isAggregate=true`;
    const res = await fetchJson<{ data: SkaterRow[] }>(url);
    all.push(...res.data);
    if (res.data.length < PAGE_SIZE) break;
  }
  return all.slice(0, total);
}

async function fetchLanding(id: number): Promise<LandingResponse> {
  return fetchJson<LandingResponse>(
    `https://api-web.nhle.com/v1/player/${id}/landing`,
  );
}

function toStints(
  landing: LandingResponse,
  teams: Map<string, string>,
  playerName: string,
): SeasonStint[] {
  const nhlRows = landing.seasonTotals.filter(
    (s) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2,
  );

  // Within a season, array order is chronological — used for mid-season trade order.
  const bySeason = new Map<number, LandingSeason[]>();
  for (const row of nhlRows) {
    const arr = bySeason.get(row.season) ?? [];
    arr.push(row);
    bySeason.set(row.season, arr);
  }

  const stints: SeasonStint[] = [];
  const seasons = [...bySeason.keys()].sort((a, b) => a - b);
  for (const season of seasons) {
    const rows = bySeason.get(season)!;
    rows.forEach((row, idx) => {
      const team = teams.get(row.teamName.default);
      if (!team) {
        console.warn(
          `  ${playerName}: no triCode for "${row.teamName.default}", dropping stint`,
        );
        return;
      }
      const stint: SeasonStint = {
        season: String(season),
        team,
        gamesPlayed: row.gamesPlayed,
      };
      if (rows.length > 1) stint.stintOrder = idx + 1;
      stints.push(stint);
    });
  }
  return stints;
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log("Fetching team abbreviation map...");
  const teams = await fetchTeamMap();
  console.log(`  ${teams.size} teams`);

  console.log(`Fetching top ${POOL_SIZE} skaters by career GP...`);
  const skaters = await fetchPlayerPool(POOL_SIZE);
  console.log(`  ${skaters.length} skaters`);

  console.log(`Fetching landing pages (concurrency ${CONCURRENCY})...`);
  let done = 0;
  const players = await pool(skaters, CONCURRENCY, async (s) => {
    try {
      const landing = await fetchLanding(s.playerId);
      const seasons = toStints(landing, teams, s.skaterFullName);
      done++;
      if (done % 25 === 0 || done === skaters.length) {
        console.log(`  ${done}/${skaters.length}`);
      }
      if (seasons.length === 0) return null;
      const player: Player = {
        id: s.playerId,
        name: s.skaterFullName,
        position: s.positionCode,
        seasons,
      };
      return player;
    } catch (err) {
      console.warn(
        `  failed ${s.playerId} ${s.skaterFullName}: ${(err as Error).message}`,
      );
      return null;
    }
  });

  const kept = players
    .filter((p): p is Player => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const outFile = fileURLToPath(OUT_PATH);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(kept));
  console.log(`Wrote ${kept.length} players to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
