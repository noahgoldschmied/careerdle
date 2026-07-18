import type { Player } from "./types.ts";

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
      const isMatch = action.guess.trim().toLowerCase() === target.name.trim().toLowerCase();
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
