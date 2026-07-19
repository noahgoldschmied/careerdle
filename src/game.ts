import type { Player } from "./types.ts";
import { arcSignature } from "./arc.ts";

export type Bucket = "none" | "one" | "two" | "three" | "wrong";

export interface RoundState {
  phase: "pending" | "answered";
  currentId: number;
  wasCorrect: boolean | null;
  gaveUp: boolean;
  hintsShown: 0 | 1 | 2 | 3;
  usedIds: Set<number>;
  buckets: Record<Bucket, number>;
  // Canonical name of the accepted arc-twin the user matched on a correct
  // guess. Null on incorrect or give-up. Lets the UI show what the user
  // guessed instead of the round's target.
  acceptedName: string | null;
}

export type RoundAction =
  | { type: "guess"; guess: string }
  | { type: "giveUp" }
  | { type: "next" };

const HINT_CAP = 3;

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function emptyBuckets(): Record<Bucket, number> {
  return { none: 0, one: 0, two: 0, three: 0, wrong: 0 };
}

function bucketFor(hintsShown: 0 | 1 | 2 | 3): Bucket {
  switch (hintsShown) {
    case 0: return "none";
    case 1: return "one";
    case 2: return "two";
    case 3: return "three";
  }
}

export function createInitialRound(players: Player[]): RoundState {
  const first = pickRandom(players);
  return {
    phase: "pending",
    currentId: first.id,
    wasCorrect: null,
    gaveUp: false,
    hintsShown: 0,
    usedIds: new Set([first.id]),
    buckets: emptyBuckets(),
    acceptedName: null,
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

function matchAcceptedName(
  guess: string,
  target: Player,
  players: Player[],
): string | null {
  const key = normalize(guess);
  return acceptedNames(target, players).find((n) => normalize(n) === key) ?? null;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function bumpBucket(
  buckets: Record<Bucket, number>,
  key: Bucket,
): Record<Bucket, number> {
  return { ...buckets, [key]: buckets[key] + 1 };
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
    gaveUp: false,
    hintsShown: 0,
    usedIds: new Set([...usedIds, next.id]),
    buckets: state.buckets,
    acceptedName: null,
  };
}

export function roundReducer(state: RoundState, action: RoundAction, players: Player[]): RoundState {
  switch (action.type) {
    case "guess": {
      if (state.phase !== "pending") return state;
      const target = findById(players, state.currentId);
      const matched = matchAcceptedName(action.guess, target, players);
      if (matched !== null) {
        return {
          ...state,
          phase: "answered",
          wasCorrect: true,
          acceptedName: matched,
          buckets: bumpBucket(state.buckets, bucketFor(state.hintsShown)),
        };
      }
      // Wrong guess: reveal the next hint if any remain, otherwise the round
      // ends as "wrong".
      if (state.hintsShown < HINT_CAP) {
        return {
          ...state,
          hintsShown: (state.hintsShown + 1) as 0 | 1 | 2 | 3,
        };
      }
      return {
        ...state,
        phase: "answered",
        wasCorrect: false,
        buckets: bumpBucket(state.buckets, "wrong"),
      };
    }
    case "giveUp": {
      if (state.phase !== "pending") return state;
      return {
        ...state,
        phase: "answered",
        wasCorrect: false,
        gaveUp: true,
        hintsShown: HINT_CAP,
        buckets: bumpBucket(state.buckets, "wrong"),
      };
    }
    case "next": {
      if (state.phase !== "answered") return state;
      return nextRound(state, players);
    }
  }
}
