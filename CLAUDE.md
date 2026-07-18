# Careerdle

Career-arc guessing game — show a player's team-by-team career, user guesses who. MVP is hockey (NHL); other sports may follow.

## Stack

- Vite + React 19 + TypeScript, ESM (`"type": "module"`)
- No backend — static client reads `public/data/players.json` at boot
- Node 24, npm; `tsx` runs TS scripts directly

## Data pipeline (`npm run build:data`)

`scripts/build-data.ts` writes `public/data/players.json` from three NHL public endpoints:

1. `api.nhle.com/stats/rest/en/team` → `Map<fullName, triCode>` for 62 franchises **including defunct** (QUE, MNS, CGS, HFD, ATL, WPG-old…). This is the only source of triCodes; landing rows give full names only.
2. `api.nhle.com/stats/rest/en/skater/summary` → top 500 skaters by career GP. **Paginated at 100/page — hard cap, must loop `start`.**
3. `api-web.nhle.com/v1/player/{id}/landing` → `seasonTotals`. Filter to `leagueAbbrev==="NHL" && gameTypeId===2` to drop junior/college rows. Multiple rows per season = mid-season trade; **array order within a season is chronological** and drives `stintOrder`.

Rate-limit gotcha: the landing endpoint 429s hard past ~4 concurrent. Script has exponential backoff + `retry-after` respect. Don't raise `CONCURRENCY`.

`players.json` is **committed source data**, not build output. Regenerate and commit when refreshing (roster moves are rare; a nightly cron is a future nice-to-have).

## Schema (`src/types.ts`)

`Player.seasons: SeasonStint[]` where each stint is `{season, team (triCode), gamesPlayed, stintOrder?}`. Multiple stints per season = mid-season trade; `stintOrder` present only then. Game logic derives the display arc by walking stints and collapsing consecutive same-team entries.

## Game shape

- One guess per round, unlimited rounds; session-scoped accuracy % in the header
- Full career arc (teams + years) shown up front — no progressive reveal
- Autocomplete name input (case-insensitive, whitespace-trimmed, exact-word matches rank first)
- Round state machine lives in `src/game.ts` (`roundReducer`, `createInitialRound`); no persistence between sessions

## Modules

- `src/data.ts` — `loadPlayers()` fetches `/data/players.json` at boot
- `src/teams.ts` — `TEAMS: Record<TriCode, TeamMeta>` covers all 44 triCodes that appear in `players.json` (32 current + 12 defunct). `hasLogo: true` iff a bundled SVG exists at `public/logos/{TRI}.svg`. Add new triCodes here whenever the data pipeline surfaces one.
- `src/arc.ts` — pure `collapseArc(stints) → DisplayChip[]`. Merges consecutive same-team stints (including across mid-season trades and lockout gaps); splits only when the team changes. Each chip carries `joinedMidSeason` / `leftMidSeason` flags derived from adjacent same-season stints.
- `src/matching.ts` — `matchPlayers(query, players, limit)`; ranks exact-word > word-boundary prefix > name-prefix > substring
- `src/game.ts` — round reducer + initial state

## Arc display rules (`src/components/TeamChip.tsx`)

Chip label is `TRI 'YY–'YY`, but mid-season trade seasons are trimmed off the visible range to avoid year overlaps between adjacent chips:

- `joinedMidSeason` → displayed start year is `startYear + 1` (player wasn't at the team in the fall)
- `leftMidSeason` → displayed end year is `endYear − 1` (player wasn't at the team in the spring)
- If the two collapse to the same year, the label shows a single year

Example: player at LAK 88–93, traded to PIT for part of 93–94, traded back to LAK for the rest of 93–94 through 95–96 → renders as `LAK '88–'93`, `PIT '93`, `LAK '94–'96` — no repeated year across the two LAK chips.

## Logos

Try `/logos/{TRI}.svg` for the 32 current franchises (bundled via `npm run build:logos` — a one-shot script that downloads `assets.nhle.com/logos/nhl/svg/{TRI}_light.svg`). Defunct triCodes fall back to a colored square with the tri-code text, using `TeamMeta.color`.

## Scripts

- `npm run dev` — Vite dev server with HMR (React Fast Refresh)
- `npm run build` — typecheck (`tsc -b`) + Vite production build
- `npm run test:run` — Vitest full suite (jsdom, globals off). Focus one file with `-- src/foo.test.ts`
- `npm run build:data` — regenerate `public/data/players.json` from NHL endpoints
- `npm run build:logos` — regenerate `public/logos/*.svg` from `assets.nhle.com`

Tests live only for pure-logic modules (`arc`, `matching`, `game`, `data`). Components are verified visually via `npm run dev`.

## Branching

`chore/*` for setup, `feat/*` for features. Small branches, one concern each.
