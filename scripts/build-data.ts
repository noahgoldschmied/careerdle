import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Player, Pool, SeasonStint } from "../src/types.ts";

const ALL_TIME_POOL_SIZE = 500;
const PAGE_SIZE = 100;
const CONCURRENCY = 4;
const MAX_RETRIES = 5;
const OUT_PATH = new URL("../public/data/players.json", import.meta.url);
const CACHE_DIR = new URL("../.cache/landing/", import.meta.url);

interface TeamRow {
  fullName: string;
  triCode: string;
}

interface SkaterRow {
  playerId: number;
  skaterFullName: string;
  positionCode: string;
  gamesPlayed: number;
  points: number;
}

interface LandingSeason {
  season: number;
  gameTypeId: number;
  leagueAbbrev: string;
  gamesPlayed: number;
  points: number;
  teamName: { default: string };
}

interface LandingResponse {
  seasonTotals: LandingSeason[];
  birthCountry?: string;
}

interface SeasonRow {
  id: number;
  startDate: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
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

async function fetchCurrentSeasonId(): Promise<number> {
  const res = await fetchJson<{ data: SeasonRow[] }>(
    "https://api.nhle.com/stats/rest/en/season",
  );
  // NOTE: `data` is NOT sorted by id (verified empirically — the plan's
  // assumption that data[0] is the latest season is false; the API returns
  // an effectively unordered list, e.g. 1953-54 appears first). Instead,
  // pick the most recent season that has already started.
  const now = Date.now();
  const started = res.data
    .filter((s) => new Date(s.startDate).getTime() <= now)
    .sort((a, b) => b.id - a.id);
  const latest = started[0];
  if (!latest) throw new Error("no seasons returned");
  return latest.id;
}

async function fetchAllTime(total: number): Promise<SkaterRow[]> {
  const sort = encodeURIComponent(
    JSON.stringify([{ property: "points", direction: "DESC" }]),
  );
  // Total is known; fire all pages concurrently.
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      const start = i * PAGE_SIZE;
      const url =
        `https://api.nhle.com/stats/rest/en/skater/summary` +
        `?limit=${PAGE_SIZE}&start=${start}&sort=${sort}` +
        `&cayenneExp=gameTypeId=2&isAggregate=true`;
      return fetchJson<{ data: SkaterRow[] }>(url);
    }),
  );
  return pages.flatMap((p) => p.data).slice(0, total);
}

async function fetchActive(seasonId: number): Promise<SkaterRow[]> {
  const sort = encodeURIComponent(
    JSON.stringify([{ property: "points", direction: "DESC" }]),
  );
  const cayenne = encodeURIComponent(
    `gameTypeId=2 and seasonId=${seasonId}`,
  );
  const all: SkaterRow[] = [];
  let start = 0;
  while (true) {
    const url =
      `https://api.nhle.com/stats/rest/en/skater/summary` +
      `?limit=${PAGE_SIZE}&start=${start}&sort=${sort}` +
      `&cayenneExp=${cayenne}&isAggregate=false`;
    const res = await fetchJson<{ data: SkaterRow[] }>(url);
    all.push(...res.data);
    if (res.data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return all;
}

async function readCachedLanding(id: number): Promise<LandingResponse | null> {
  const path = fileURLToPath(new URL(`${id}.json`, CACHE_DIR));
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as LandingResponse;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeCachedLanding(id: number, data: LandingResponse): Promise<void> {
  const path = fileURLToPath(new URL(`${id}.json`, CACHE_DIR));
  await writeFile(path, JSON.stringify(data));
}

async function fetchLanding(id: number, currentSeason: number): Promise<LandingResponse> {
  const cached = await readCachedLanding(id);
  // Cache is only valid if the player didn't play in the current season —
  // an in-progress season can change (mid-season trades, appended games).
  const touchesCurrent = cached?.seasonTotals.some((s) => s.season === currentSeason);
  if (cached && !touchesCurrent) return cached;
  const fresh = await fetchJson<LandingResponse>(
    `https://api-web.nhle.com/v1/player/${id}/landing`,
  );
  await writeCachedLanding(id, fresh);
  return fresh;
}

function toStints(
  landing: LandingResponse,
  teams: Map<string, string>,
  playerName: string,
): SeasonStint[] {
  const nhlRows = landing.seasonTotals.filter(
    (s) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2,
  );
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

function careerPointsFromLanding(landing: LandingResponse): number {
  return landing.seasonTotals
    .filter((s) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2)
    .reduce((sum, s) => sum + (s.points ?? 0), 0);
}

interface Candidate {
  playerId: number;
  skaterFullName: string;
  positionCode: string;
  pools: Set<Pool>;
}

function unionCandidates(
  allTime: SkaterRow[],
  active: SkaterRow[],
): Candidate[] {
  const byId = new Map<number, Candidate>();
  const add = (rows: SkaterRow[], tag: Pool) => {
    for (const r of rows) {
      const existing = byId.get(r.playerId);
      if (existing) {
        existing.pools.add(tag);
      } else {
        byId.set(r.playerId, {
          playerId: r.playerId,
          skaterFullName: r.skaterFullName,
          positionCode: r.positionCode,
          pools: new Set([tag]),
        });
      }
    }
  };
  add(allTime, "allTime");
  add(active, "active");
  return [...byId.values()];
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
  await mkdir(fileURLToPath(CACHE_DIR), { recursive: true });

  console.log("Bootstrapping (teams, season, all-time, active) in parallel...");
  const [teams, allTime, [currentSeason, active]] = await Promise.all([
    fetchTeamMap(),
    fetchAllTime(ALL_TIME_POOL_SIZE),
    fetchCurrentSeasonId().then(async (id) => [id, await fetchActive(id)] as const),
  ]);
  console.log(
    `  ${teams.size} teams (season ${currentSeason}), ${allTime.length} all-time, ${active.length} active`,
  );

  const candidates = unionCandidates(allTime, active);
  console.log(`Unioned to ${candidates.length} candidates`);

  console.log(
    `Fetching landing pages (concurrency ${CONCURRENCY}, disk-cached)...`,
  );
  let done = 0;
  const players = await pool(candidates, CONCURRENCY, async (c) => {
    try {
      const landing = await fetchLanding(c.playerId, currentSeason);
      const seasons = toStints(landing, teams, c.skaterFullName);
      const careerPoints = careerPointsFromLanding(landing);
      done++;
      if (done % 25 === 0 || done === candidates.length) {
        console.log(`  ${done}/${candidates.length}`);
      }
      if (seasons.length === 0) return null;
      const player: Player = {
        id: c.playerId,
        name: c.skaterFullName,
        position: c.positionCode,
        seasons,
        pools: [...c.pools],
        careerPoints,
        birthCountry: landing.birthCountry ?? "",
      };
      return player;
    } catch (err) {
      console.warn(
        `  failed ${c.playerId} ${c.skaterFullName}: ${(err as Error).message}`,
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
