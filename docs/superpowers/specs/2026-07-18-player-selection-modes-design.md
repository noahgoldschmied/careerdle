# Player-Selection Modes — Design

Date: 2026-07-18
Branch: `feat/player-selection`

## Goal

Let the user pick which pool of players the game draws from. Ship three modes:

- **All-time** — top 500 skaters by career points (current pool, retargeted from GP to points)
- **Active — Easy** — top 300 skaters who played the most recent NHL season, ranked by career points
- **Active — Hard** — every skater who played the most recent NHL season (~700)

Selector is always visible under the career-arc panel; switching a mode immediately re-rolls the current player and resets session accuracy.

## Data pipeline (`scripts/build-data.ts`)

Two independent fetches, unioned by `playerId`:

1. **Current season lookup** — one call to `https://api.nhle.com/stats/rest/en/season`; take the latest entry's `id` (e.g., `20252026`). Avoids yearly hardcode maintenance.

2. **All-time fetch** — existing paginated `skater/summary` call, but sort switches from `gamesPlayed` to `points`. Still 500 rows, paginated 100 at a time (hard cap).

3. **Active fetch (new)** — same endpoint with a season filter: `cayenneExp=gameTypeId=2 and seasonId=<current>`, sorted by `points` DESC, `isAggregate=false`. Paginated. All active skaters returned (~700).

4. **Union** — deduplicate by `playerId`. Each player carries the union of tags: `pools: ("allTime" | "active")[]`.

5. **Career-points normalization** — the all-time fetch uses `isAggregate=true`, so its `points` field is career points. The active fetch uses `isAggregate=false` (needed to filter by season), so its `points` field is a single-season total and cannot be used for career ranking. We normalize by summing `points` across `leagueAbbrev==="NHL" && gameTypeId===2` rows in the landing response — which we already fetch for every unioned player. Zero extra API cost. Requires adding `points: number` to the `LandingSeason` interface. If the landing endpoint doesn't expose per-season points (to be confirmed during implementation via a spot-check on one playerId), fall back to a second aggregate `skater/summary` call constrained to the active-only playerIds.

6. **Landing fetches** run over the full union (~1000-1100 players). Concurrency stays at 4 (rate-limit ceiling). Build time roughly doubles vs. current — acceptable, this runs only when refreshing data.

7. Output schema (`public/data/players.json`) — each `Player` now has:
   - `pools: ("allTime" | "active")[]`
   - `careerPoints: number`

## Schema changes (`src/types.ts`)

```ts
export type Mode = "allTime" | "activeEasy" | "activeHard";
export type Pool = "allTime" | "active";

export interface Player {
  id: number;
  name: string;
  position: string;
  seasons: SeasonStint[];
  pools: Pool[];       // new
  careerPoints: number; // new
}
```

## Client state (`src/App.tsx`, `src/game.ts`)

- `App` owns `mode` state, defaults to `"allTime"`.
- Derived `pool: Player[]` memoized from `(players, mode)`:
  - `allTime` → `players.filter(p => p.pools.includes("allTime"))`
  - `activeHard` → `players.filter(p => p.pools.includes("active"))`
  - `activeEasy` → `activeHard` sorted by `careerPoints` desc, sliced to 300
- The derivation lives in `src/pools.ts` (new pure module) so it's unit-testable.
- `roundReducer` gains a `{type: "reset", pool: Player[]}` action:
  - resets `currentId` to a random pick from `pool`
  - zeroes `correct` / `attempted`
  - clears `phase`/`wasCorrect`
- The reducer's closure over `players` becomes a closure over the derived `pool`. `App` re-creates the reducer whenever `pool` identity changes (`useReducer` isn't re-keyed; use `useMemo` on the reducer function or accept a `pool` argument to each action — simpler is to always pass `pool` in via a ref-like closure and dispatch reset on mode change).
- On mode change: `App` calls `dispatch({type: "reset", pool})` and updates the `mode` state.

## UI (`src/components/RoundView.tsx`, `src/components/ModeSelector.tsx`)

New component `ModeSelector.tsx`:

- Props: `{ mode: Mode; poolSize: number; onChange: (m: Mode) => void }`
- Three segmented-style buttons in a row: `All-time` / `Active — Easy` / `Active — Hard`
- Selected button gets a filled/inverted style; others are outlined
- Below the row, a small caption showing pool size: e.g. `500 players`, `top 300 by career points`, `697 players`

Rendered inside `RoundView`, positioned:
- below `CareerArc`
- above `round__controls` (guess input + reveal)

Selector is enabled at all times — clicking mid-round immediately triggers a re-roll.

## Files touched

- `scripts/build-data.ts` — season lookup, active fetch, union, career-points summing, expanded interfaces
- `src/types.ts` — `Mode`, `Pool`, add `pools` + `careerPoints` to `Player`
- `src/pools.ts` — new, pure `derivePool(players, mode): Player[]`
- `src/game.ts` — `reset` action + handler
- `src/App.tsx` — `mode` state, derived pool, reset wiring, pass `mode`/`onModeChange`/`poolSize` to `RoundView`
- `src/components/RoundView.tsx` — accept and render `ModeSelector`
- `src/components/ModeSelector.tsx` — new
- `src/App.css` — styles for the selector row + selected state
- `public/data/players.json` — regenerated (committed source data)

## Testing

Per CLAUDE.md — tests only for pure-logic modules:

- `src/pools.test.ts` — derivation for each mode (correct filter, sort, slice)
- `src/game.test.ts` — extend with reset action (resets counters, picks from provided pool)

No component tests. Visual verification via `npm run dev`.

## Non-goals

- No per-mode persistence across sessions (session-scoped, matches existing accuracy behavior).
- No mode-specific difficulty tuning beyond pool composition.
- No additional pools (retired-only, by-position, era-based) — those are cheap to add later given the tagged-pool schema.
