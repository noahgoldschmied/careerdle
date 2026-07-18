import { describe, it, expect } from "vitest";
import { createInitialRound, roundReducer } from "./game.ts";
import type { RoundState } from "./game.ts";
import type { Player } from "./types.ts";

const P: Player[] = [
  { id: 1, name: "Sidney Crosby", position: "C", seasons: [], pools: ["allTime"], careerPoints: 0 },
  { id: 2, name: "Connor McDavid", position: "C", seasons: [], pools: ["allTime"], careerPoints: 0 },
  { id: 3, name: "Nathan MacKinnon", position: "C", seasons: [], pools: ["allTime"], careerPoints: 0 },
];

describe("createInitialRound", () => {
  it("starts in pending with 0/0 and current in used", () => {
    const s = createInitialRound(P);
    expect(s.phase).toBe("pending");
    expect(s.correct).toBe(0);
    expect(s.attempted).toBe(0);
    expect(s.usedIds.has(s.currentId)).toBe(true);
  });
});

describe("roundReducer", () => {
  it("correct guess flips to answered with wasCorrect=true", () => {
    const s: any = { phase: "pending", currentId: 1, wasCorrect: null, usedIds: new Set([1]), correct: 0, attempted: 0 };
    const n = roundReducer(s, { type: "guess", guess: "sidney crosby" }, P);
    expect(n).toMatchObject({ phase: "answered", wasCorrect: true, correct: 1, attempted: 1 });
  });

  it("incorrect guess: attempted++, correct unchanged", () => {
    const s: any = { phase: "pending", currentId: 1, wasCorrect: null, usedIds: new Set([1]), correct: 0, attempted: 0 };
    const n = roundReducer(s, { type: "guess", guess: "Wayne Gretzky" }, P);
    expect(n).toMatchObject({ phase: "answered", wasCorrect: false, correct: 0, attempted: 1 });
  });

  it("reveal counts as an incorrect answer", () => {
    const s: any = { phase: "pending", currentId: 1, wasCorrect: null, usedIds: new Set([1]), correct: 0, attempted: 0 };
    const n = roundReducer(s, { type: "reveal" }, P);
    expect(n).toMatchObject({ phase: "answered", wasCorrect: false, attempted: 1 });
  });

  it("guess is a no-op when already answered", () => {
    const s: any = { phase: "answered", currentId: 1, wasCorrect: false, usedIds: new Set([1]), correct: 0, attempted: 1 };
    const n = roundReducer(s, { type: "guess", guess: "Sidney Crosby" }, P);
    expect(n).toBe(s);
  });

  it("next picks an unused player when possible", () => {
    const s: any = { phase: "answered", currentId: 1, wasCorrect: true, usedIds: new Set([1]), correct: 1, attempted: 1 };
    const n = roundReducer(s, { type: "next" }, P);
    expect(n.phase).toBe("pending");
    expect(n.wasCorrect).toBeNull();
    expect(n.currentId).not.toBe(1);
    expect(n.usedIds.has(n.currentId)).toBe(true);
  });

  it("next resets usedIds when everyone has been used", () => {
    const s: any = { phase: "answered", currentId: 3, wasCorrect: true, usedIds: new Set([1,2,3]), correct: 3, attempted: 3 };
    const n = roundReducer(s, { type: "next" }, P);
    expect(n.usedIds.size).toBe(1);
  });

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
});
