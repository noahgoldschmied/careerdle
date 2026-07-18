# Playerdle

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

## Game shape (planned, not built)

- One guess per round, unlimited rounds; track session accuracy %
- Full career arc (teams + years) shown up front — no progressive reveal
- Autocomplete name input
- Logos: try `assets.nhle.com/logos/nhl/svg/{TRI}_light.svg` (current 32 teams only, 404s on defunct); fall back to colored tri-code chip

## Branching

`chore/*` for setup, `feat/*` for features. Small branches, one concern each.
