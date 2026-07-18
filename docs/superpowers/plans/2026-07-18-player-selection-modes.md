# Player-Selection Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user switch between three player pools (All-time top 500 by career points, Active — Easy top 300 by career points, Active — Hard all who played the most recent season) via a selector under the career-arc panel; switching resets the round.

**Architecture:** Pipeline unions two `skater/summary` fetches (all-time by points + current-season active) and tags each player with which pool(s) they came from. Client derives the current pool from `mode` state; the Game subtree is keyed by `mode` so a change remounts it — that gives a fresh initial round and 0/0 stats without a reducer reset action.

**Tech Stack:** Vite + React 19 + TypeScript, `tsx` for the pipeline, Vitest for pure-logic tests.

## Global Constraints

- No commits between plan tasks — user commits themselves.
- No TDD — implementation first, tests only for pure-logic modules (`arc`, `matching`, `game`, `data`, `pools`) at the end.
- ESM (`import` paths must include `.ts`/`.tsx` extensions).
- NHL landing fetch concurrency stays at 4 (hard rate-limit ceiling).
- `players.json` is committed source data — regenerated deliberately, not on every dev build.
- Design spec: `docs/superpowers/specs/2026-07-18-player-selection-modes-design.md`.

---

## Task 1: Extend types and add pool derivation module

Introduces the type surface that later tasks depend on. Also creates the pure-logic derivation function so App can call it once wired.

**Files:**
- Modify: `src/types.ts`
- Create: `src/pools.ts`

**Interfaces:**
- Consumes: nothing (leaf task).
- Produces:
  - `type Mode = "allTime" | "activeEasy" | "activeHard"`
  - `type Pool = "allTime" | "active"`
  - `Player.pools: Pool[]`
  - `Player.careerPoints: number`
  - `derivePool(players: Player[], mode: Mode): Player[]`
  - `poolLabel(mode: Mode): string` — short caption used by `ModeSelector`

- [ ] **Step 1: Extend `src/types.ts`**

Replace the file contents with:

```ts
export type Pool = "allTime" | "active";
export type Mode = "allTime" | "activeEasy" | "activeHard";

export interface Player {
  id: number;
  name: string;
  position: string;
  seasons: SeasonStint[];
  pools: Pool[];
  careerPoints: number;
}

export interface SeasonStint {
  season: string;
  team: string;
  gamesPlayed: number;
  stintOrder?: number;
}
```

- [ ] **Step 2: Create `src/pools.ts`**

```ts
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
      return "All-time";
    case "activeEasy":
      return "Active — Easy";
    case "activeHard":
      return "Active — Hard";
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: passes. Consumers of `Player` (e.g., `build-data.ts`, components) may now emit TS errors about missing `pools`/`careerPoints` — that's fine, they'll be fixed in Task 2 and Task 4. If any errors appear in files this task didn't touch **other than** `scripts/build-data.ts`, `src/App.tsx`, `src/data.ts`, or components consuming `Player`, stop and investigate.

---

## Task 2: Update data pipeline and regenerate `players.json`

Two independent fetches (all-time by points, active by current season), union by `playerId`, sum career points from landing rows.

**Files:**
- Modify: `scripts/build-data.ts`
- Regenerate: `public/data/players.json`

**Interfaces:**
- Consumes: `Player`, `Pool` (Task 1).
- Produces: `players.json` where every entry has `pools: Pool[]` and `careerPoints: number`.

- [ ] **Step 1: Rewrite `scripts/build-data.ts`**

Replace the file contents:

```ts
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Player, Pool, SeasonStint } from "../src/types.ts";

const ALL_TIME_POOL_SIZE = 500;
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
}

interface SeasonRow {
  id: number;
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
  // `data` is sorted descending by id; latest is the current season.
  const latest = res.data[0];
  if (!latest) throw new Error("no seasons returned");
  return latest.id;
}

async function fetchAllTime(total: number): Promise<SkaterRow[]> {
  const sort = encodeURIComponent(
    JSON.stringify([{ property: "points", direction: "DESC" }]),
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
  console.log("Fetching team abbreviation map...");
  const teams = await fetchTeamMap();
  console.log(`  ${teams.size} teams`);

  console.log("Looking up current season...");
  const currentSeason = await fetchCurrentSeasonId();
  console.log(`  current season: ${currentSeason}`);

  console.log(`Fetching top ${ALL_TIME_POOL_SIZE} skaters by career points...`);
  const allTime = await fetchAllTime(ALL_TIME_POOL_SIZE);
  console.log(`  ${allTime.length} all-time`);

  console.log(`Fetching active skaters (season ${currentSeason})...`);
  const active = await fetchActive(currentSeason);
  console.log(`  ${active.length} active`);

  const candidates = unionCandidates(allTime, active);
  console.log(`Unioned to ${candidates.length} candidates`);

  console.log(`Fetching landing pages (concurrency ${CONCURRENCY})...`);
  let done = 0;
  const players = await pool(candidates, CONCURRENCY, async (c) => {
    try {
      const landing = await fetchLanding(c.playerId);
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
```

- [ ] **Step 2: Spot-check that landing exposes per-season points**

Before running the full pipeline, verify `seasonTotals[].points` exists in the landing response. Run:

```bash
curl -s https://api-web.nhle.com/v1/player/8478402/landing | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); const r=j.seasonTotals.find(x=>x.leagueAbbrev==='NHL'&&x.gameTypeId===2); console.log(r)})"
```

(McDavid — playerId 8478402.) Expected: printed row includes a `points` numeric field. If it doesn't, stop and switch `careerPointsFromLanding` to source points via a second aggregate `skater/summary` call (see design spec §5 fallback).

- [ ] **Step 3: Regenerate `players.json`**

Run: `npm run build:data`
Expected: ends with `Wrote <N> players to .../public/data/players.json`, where `N` is roughly 900-1100 (union of ~500 all-time and ~700 active, minus duplicates and any dropped rows). Runtime ~5-7 minutes at concurrency 4.

- [ ] **Step 4: Sanity-check the output**

```bash
node -e "const p=require('./public/data/players.json'); console.log('total',p.length); console.log('allTime',p.filter(x=>x.pools.includes('allTime')).length); console.log('active',p.filter(x=>x.pools.includes('active')).length); console.log('both',p.filter(x=>x.pools.length===2).length); console.log('sample',p.find(x=>x.name==='Alex Ovechkin')||p[0]);"
```

Expected: `allTime` ≈ 500, `active` ≈ 700, `both` > 0 (Ovechkin/Crosby/etc.), sample entry has `pools`, `careerPoints`, and non-empty `seasons`.

---

## Task 3: `ModeSelector` component and styles

Presentation-only. Wired into the tree in Task 4.

**Files:**
- Create: `src/components/ModeSelector.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `Mode`, `poolLabel` (Task 1).
- Produces: `<ModeSelector mode poolSize onChange>` — no external state.

- [ ] **Step 1: Create `src/components/ModeSelector.tsx`**

```tsx
import type { Mode } from "../types.ts";
import { poolLabel } from "../pools.ts";

const MODES: Mode[] = ["allTime", "activeEasy", "activeHard"];

interface Props {
  mode: Mode;
  poolSize: number;
  onChange: (mode: Mode) => void;
}

export function ModeSelector({ mode, poolSize, onChange }: Props) {
  return (
    <div className="mode-selector">
      <div className="mode-selector__row" role="tablist" aria-label="Player pool">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`mode-selector__btn${mode === m ? " is-selected" : ""}`}
            onClick={() => {
              if (mode !== m) onChange(m);
            }}
          >
            {poolLabel(m)}
          </button>
        ))}
      </div>
      <div className="mode-selector__caption">{poolSize} players</div>
    </div>
  );
}
```

- [ ] **Step 2: Append styles to `src/App.css`**

Append at the end of the file:

```css
/* --- mode selector --- */

.mode-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-selector__row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-selector__btn {
  flex: 1 1 0;
  min-width: 120px;
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.mode-selector__btn:hover:not(.is-selected) {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--text-muted);
}

.mode-selector__btn.is-selected {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.mode-selector__caption {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  align-self: flex-end;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: passes for `ModeSelector.tsx`. Errors elsewhere from unwired mode state are expected until Task 4.

---

## Task 4: Wire mode state into App and RoundView

`App` owns `mode` + derived `pool`. The `Game` subtree is keyed by `mode` so switching modes remounts it — that resets the reducer to `createInitialRound(pool)` and zeroes stats without any reducer changes. `ModeSelector` renders inside `RoundView` between the career arc and the guess controls.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/RoundView.tsx`

**Interfaces:**
- Consumes: `derivePool`, `Mode` (Task 1); `ModeSelector` (Task 3).
- Produces: no exported interface changes.

- [ ] **Step 1: Rewrite `src/App.tsx`**

Replace the file contents:

```tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import "./App.css";
import type { Mode, Player } from "./types.ts";
import { loadPlayers } from "./data.ts";
import { createInitialRound, roundReducer } from "./game.ts";
import { derivePool } from "./pools.ts";
import { StatsHeader } from "./components/StatsHeader.tsx";
import { RoundView } from "./components/RoundView.tsx";

function App() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("allTime");

  useEffect(() => {
    loadPlayers()
      .then(setPlayers)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="app-status">Failed to load: {error}</div>;
  if (!players) return <div className="app-status">Loading…</div>;

  return <ModedGame players={players} mode={mode} onModeChange={setMode} />;
}

interface ModedGameProps {
  players: Player[];
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

function ModedGame({ players, mode, onModeChange }: ModedGameProps) {
  const pool = useMemo(() => derivePool(players, mode), [players, mode]);
  // key={mode} remounts Game on mode change → fresh initial round, 0/0 stats.
  return (
    <Game
      key={mode}
      pool={pool}
      mode={mode}
      onModeChange={onModeChange}
    />
  );
}

interface GameProps {
  pool: Player[];
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

function Game({ pool, mode, onModeChange }: GameProps) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof createInitialRound>, a: Parameters<typeof roundReducer>[1]) =>
      roundReducer(s, a, pool),
    pool,
    createInitialRound,
  );
  const current = pool.find((p) => p.id === state.currentId)!;

  return (
    <div className="app">
      <StatsHeader correct={state.correct} attempted={state.attempted} />
      <main>
        <RoundView
          player={current}
          players={pool}
          state={state}
          mode={mode}
          poolSize={pool.length}
          onModeChange={onModeChange}
          onGuess={(name) => dispatch({ type: "guess", guess: name })}
          onReveal={() => dispatch({ type: "reveal" })}
          onNext={() => dispatch({ type: "next" })}
        />
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Rewrite `src/components/RoundView.tsx`**

Replace the file contents:

```tsx
import type { Mode, Player } from "../types.ts";
import type { RoundState } from "../game.ts";
import { CareerArc } from "./CareerArc.tsx";
import { GuessInput } from "./GuessInput.tsx";
import { ModeSelector } from "./ModeSelector.tsx";

interface Props {
  player: Player;
  players: Player[];
  state: RoundState;
  mode: Mode;
  poolSize: number;
  onModeChange: (mode: Mode) => void;
  onGuess: (name: string) => void;
  onReveal: () => void;
  onNext: () => void;
}

export function RoundView({
  player,
  players,
  state,
  mode,
  poolSize,
  onModeChange,
  onGuess,
  onReveal,
  onNext,
}: Props) {
  const answered = state.phase === "answered";
  return (
    <section className="round">
      <CareerArc stints={player.seasons} />
      <ModeSelector mode={mode} poolSize={poolSize} onChange={onModeChange} />
      <div className="round__controls">
        <GuessInput players={players} disabled={answered} onGuess={onGuess} />
        <button type="button" onClick={onReveal} disabled={answered}>Reveal</button>
      </div>
      {answered && (
        <div className={`round__result ${state.wasCorrect ? "is-correct" : "is-wrong"}`}>
          <div>{state.wasCorrect ? "Correct!" : "Wrong."} The answer was <strong>{player.name}</strong>.</div>
          <button type="button" onClick={onNext}>Next player →</button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run build`
Expected: passes cleanly. If `data.ts` complains about `Player` fields (e.g., unknown type mismatch), open it and confirm it only calls `fetch(...).json()` and casts — no field-by-field construction. Its current implementation should still be compatible with the extended schema.

- [ ] **Step 4: Run the dev server and drive the feature**

Run: `npm run dev`
Then in a browser:
1. Load the page — default mode is `All-time`, caption reads `500 players`, a random top-500-points player appears.
2. Click `Active — Easy` — a new player appears, caption reads `300 players`, header stats reset to `0/0`.
3. Click `Active — Hard` — new player, caption reads ~`700 players`, stats reset.
4. Make a guess (any name), then switch modes mid-round — reveal/answered UI disappears, new player, stats reset.
5. Confirm the selected button has the filled accent style.

If any step fails, fix before proceeding.

---

## Task 4.5: Accept twin/identical-career guesses

Players like the Sedin twins have visually identical career arcs (same team, same years, same mid-season flags). Without special handling, a random pick between them is a 50/50 guess with no signal from the arc. This task makes the guess reducer accept any name whose collapsed arc matches the current player's arc within the pool.

**Files:**
- Modify: `src/arc.ts` — add `arcSignature`
- Modify: `src/game.ts` — twin-aware guess check

**Interfaces:**
- Consumes: `collapseArc` (existing), `Player`, `SeasonStint` (types).
- Produces: `arcSignature(stints: SeasonStint[]): string` — deterministic string keyed on visible chip attributes (team, displayed year range, mid-season flags).

- [ ] **Step 1: Extend `src/arc.ts`**

Append to the end of the file:

```ts
export function arcSignature(stints: SeasonStint[]): string {
  return collapseArc(stints)
    .map((c) => `${c.team}|${c.startYear}|${c.endYear}|${c.joinedMidSeason ? 1 : 0}|${c.leftMidSeason ? 1 : 0}`)
    .join(";");
}
```

- [ ] **Step 2: Update `src/game.ts` guess case**

Replace the entire file contents with:

```ts
import type { Player } from "./types.ts";
import { arcSignature } from "./arc.ts";

export interface RoundState {
  phase: "pending" | "answered";
  currentId: number;
  wasCorrect: boolean | null;
  usedIds: Set<number>;
  correct: number;
  attempted: number;
}

export type RoundAction =
  | { type: "guess"; guess: string }
  | { type: "reveal" }
  | { type: "next" };

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function createInitialRound(players: Player[]): RoundState {
  const first = pickRandom(players);
  return {
    phase: "pending",
    currentId: first.id,
    wasCorrect: null,
    usedIds: new Set([first.id]),
    correct: 0,
    attempted: 0,
  };
}

function findById(players: Player[], id: number): Player {
  const p = players.find((x) => x.id === id);
  if (!p) throw new Error(`Player id not found: ${id}`);
  return p;
}

function acceptedNames(target: Player, players: Player[]): string[] {
  const sig = arcSignature(target.seasons);
  return players
    .filter((p) => arcSignature(p.seasons) === sig)
    .map((p) => p.name);
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function nextRound(state: RoundState, players: Player[]): RoundState {
  let candidates = players.filter((p) => !state.usedIds.has(p.id));
  let usedIds = state.usedIds;
  if (candidates.length === 0) {
    candidates = players;
    usedIds = new Set();
  }
  const next = pickRandom(candidates);
  return {
    phase: "pending",
    currentId: next.id,
    wasCorrect: null,
    usedIds: new Set([...usedIds, next.id]),
    correct: state.correct,
    attempted: state.attempted,
  };
}

export function roundReducer(state: RoundState, action: RoundAction, players: Player[]): RoundState {
  switch (action.type) {
    case "guess": {
      if (state.phase !== "pending") return state;
      const target = findById(players, state.currentId);
      const accepted = new Set(acceptedNames(target, players).map(normalize));
      const isMatch = accepted.has(normalize(action.guess));
      return {
        ...state,
        phase: "answered",
        wasCorrect: isMatch,
        correct: state.correct + (isMatch ? 1 : 0),
        attempted: state.attempted + 1,
      };
    }
    case "reveal": {
      if (state.phase !== "pending") return state;
      return {
        ...state,
        phase: "answered",
        wasCorrect: false,
        attempted: state.attempted + 1,
      };
    }
    case "next": {
      if (state.phase !== "answered") return state;
      return nextRound(state, players);
    }
  }
}
```

Behavior: a player with no arc-twins in the pool → `accepted` contains only their name → identical behavior to before. A player with twins in the pool → guessing any twin's name is accepted.

**Note on reveal message:** When answered, `RoundView` shows `The answer was <target.name>`. For twin cases the "answer" text still names the picked player, not the twin — that's fine; the user's guess is credited if it matched any twin. A future polish could show "The answer was <name> (or <twin>)"; leaving out of MVP.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: passes (barring the pre-existing errors that Task 2 and Task 4 clean up).

---

## Task 5: Tests for pure logic

Extends the pure-logic test coverage per CLAUDE.md (only `arc`, `matching`, `game`, `data`, and now `pools` get tests).

**Files:**
- Create: `src/pools.test.ts`
- Modify: `src/arc.test.ts` — add `arcSignature` cases
- Modify: `src/game.test.ts` — add twin-guess-accepting cases and extend fixtures with new required `Player` fields

**Interfaces:**
- Consumes: `derivePool`, `poolLabel` (Task 1); `arcSignature` (Task 4.5); twin-aware guess reducer (Task 4.5).
- Produces: no runtime interface — test files only.

- [ ] **Step 1: Create `src/pools.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Player } from "./types.ts";
import { derivePool, poolLabel } from "./pools.ts";

function make(
  id: number,
  name: string,
  pools: Player["pools"],
  careerPoints: number,
): Player {
  return {
    id,
    name,
    position: "C",
    seasons: [{ season: "20232024", team: "TOR", gamesPlayed: 82 }],
    pools,
    careerPoints,
  };
}

describe("derivePool", () => {
  const players: Player[] = [
    make(1, "All-time Only", ["allTime"], 1500),
    make(2, "Both Pools Star", ["allTime", "active"], 1400),
    make(3, "Active Veteran", ["active"], 900),
    make(4, "Active Journeyman", ["active"], 50),
  ];

  it("allTime returns only players tagged allTime", () => {
    const result = derivePool(players, "allTime");
    expect(result.map((p) => p.id).sort()).toEqual([1, 2]);
  });

  it("activeHard returns all active players", () => {
    const result = derivePool(players, "activeHard");
    expect(result.map((p) => p.id).sort()).toEqual([2, 3, 4]);
  });

  it("activeEasy returns active players sorted by careerPoints desc, top 300", () => {
    const result = derivePool(players, "activeEasy");
    expect(result.map((p) => p.id)).toEqual([2, 3, 4]);
    expect(result[0].careerPoints).toBeGreaterThanOrEqual(result[1].careerPoints);
  });

  it("activeEasy caps the returned length at 300", () => {
    const many: Player[] = Array.from({ length: 500 }, (_, i) =>
      make(1000 + i, `p${i}`, ["active"], 500 - i),
    );
    const result = derivePool(many, "activeEasy");
    expect(result).toHaveLength(300);
    expect(result[0].careerPoints).toBe(500);
    expect(result[299].careerPoints).toBe(500 - 299);
  });

  it("activeEasy does not mutate input order", () => {
    const input = [...players];
    const before = input.map((p) => p.id);
    derivePool(input, "activeEasy");
    expect(input.map((p) => p.id)).toEqual(before);
  });
});

describe("poolLabel", () => {
  it("returns human-readable labels for each mode", () => {
    expect(poolLabel("allTime")).toBe("All-time");
    expect(poolLabel("activeEasy")).toBe("Active — Easy");
    expect(poolLabel("activeHard")).toBe("Active — Hard");
  });
});
```

- [ ] **Step 2: Extend `src/arc.test.ts` with `arcSignature` cases**

Add a new `describe` block. `arcSignature` is imported alongside the existing `collapseArc` import. Reference fixtures may already exist in the file for `collapseArc` — reuse them if convenient.

```ts
import { arcSignature } from "./arc.ts";

describe("arcSignature", () => {
  it("returns identical signatures for identical stint sequences", () => {
    const stints = [
      { season: "20002001", team: "VAN", gamesPlayed: 82 },
      { season: "20012002", team: "VAN", gamesPlayed: 79 },
    ];
    expect(arcSignature(stints)).toBe(arcSignature([...stints]));
  });

  it("differs when teams differ", () => {
    const a = [{ season: "20002001", team: "VAN", gamesPlayed: 82 }];
    const b = [{ season: "20002001", team: "TOR", gamesPlayed: 82 }];
    expect(arcSignature(a)).not.toBe(arcSignature(b));
  });

  it("differs when year ranges differ", () => {
    const a = [{ season: "20002001", team: "VAN", gamesPlayed: 82 }];
    const b = [{ season: "20012002", team: "VAN", gamesPlayed: 82 }];
    expect(arcSignature(a)).not.toBe(arcSignature(b));
  });

  it("differs when a mid-season trade splits the arc", () => {
    const soloVan = [{ season: "20002001", team: "VAN", gamesPlayed: 82 }];
    const traded = [
      { season: "20002001", team: "VAN", gamesPlayed: 40, stintOrder: 1 },
      { season: "20002001", team: "TOR", gamesPlayed: 42, stintOrder: 2 },
    ];
    expect(arcSignature(soloVan)).not.toBe(arcSignature(traded));
  });
});
```

- [ ] **Step 3: Extend `src/game.test.ts` for twin-guess acceptance and updated fixtures**

Any existing fixtures that construct a `Player` need `pools` and `careerPoints` added (`pools: ["allTime"], careerPoints: 0` is fine for tests that don't care). Add new cases for twin-guess acceptance:

```ts
it("credits a correct guess of an arc-twin's name", () => {
  const sedinStints = [
    { season: "20002001", team: "VAN", gamesPlayed: 82 },
    { season: "20012002", team: "VAN", gamesPlayed: 79 },
  ];
  const daniel: Player = {
    id: 1,
    name: "Daniel Sedin",
    position: "L",
    seasons: sedinStints,
    pools: ["allTime"],
    careerPoints: 1000,
  };
  const henrik: Player = {
    id: 2,
    name: "Henrik Sedin",
    position: "C",
    seasons: sedinStints,
    pools: ["allTime"],
    careerPoints: 1000,
  };
  const players = [daniel, henrik];
  const state: RoundState = {
    phase: "pending",
    currentId: daniel.id,
    wasCorrect: null,
    usedIds: new Set([daniel.id]),
    correct: 0,
    attempted: 0,
  };
  const next = roundReducer(state, { type: "guess", guess: "Henrik Sedin" }, players);
  expect(next.wasCorrect).toBe(true);
  expect(next.correct).toBe(1);
});

it("does not accept a non-twin's name", () => {
  const solo: Player = {
    id: 1,
    name: "Solo Player",
    position: "C",
    seasons: [{ season: "20002001", team: "VAN", gamesPlayed: 82 }],
    pools: ["allTime"],
    careerPoints: 500,
  };
  const other: Player = {
    id: 2,
    name: "Other Player",
    position: "C",
    seasons: [{ season: "20002001", team: "TOR", gamesPlayed: 82 }],
    pools: ["allTime"],
    careerPoints: 500,
  };
  const state: RoundState = {
    phase: "pending",
    currentId: solo.id,
    wasCorrect: null,
    usedIds: new Set([solo.id]),
    correct: 0,
    attempted: 0,
  };
  const next = roundReducer(state, { type: "guess", guess: "Other Player" }, [solo, other]);
  expect(next.wasCorrect).toBe(false);
});
```

Adjust the imports at the top of `game.test.ts` (`Player`, `RoundState`, `roundReducer`) if not already present.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test:run`
Expected: all tests pass, including the new `src/pools.test.ts`, the new `arcSignature`/twin cases, and the pre-existing `arc`, `matching`, `game`, `data`, `smoke` suites. If any existing test breaks because fixtures are missing the new required `Player` fields, extend the fixture with `pools: ["allTime"]` and `careerPoints: 0` as appropriate. Do not weaken the type.

---

## Verification checklist (before handoff)

- [ ] `npm run build` passes.
- [ ] `npm run test:run` passes.
- [ ] `npm run dev` — three-button selector under the career arc; switching modes swaps the player immediately and resets `X/Y` header stats to `0/0`.
- [ ] `public/data/players.json` regenerated and committed; sample entry contains `pools` + `careerPoints`.
