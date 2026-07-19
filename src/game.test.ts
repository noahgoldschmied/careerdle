import { describe, it, expect } from "vitest";
import { createInitialRound, resultBucket, roundReducer } from "./game.ts";
import type { RoundState } from "./game.ts";
import type { Player } from "./types.ts";

const P: Player[] = [
  { id: 1, name: "Sidney Crosby", position: "C", seasons: [], pools: ["allTime"], careerPoints: 0, birthCountry: "CAN" },
  { id: 2, name: "Connor McDavid", position: "C", seasons: [], pools: ["allTime"], careerPoints: 0, birthCountry: "CAN" },
  { id: 3, name: "Nathan MacKinnon", position: "C", seasons: [], pools: ["allTime"], careerPoints: 0, birthCountry: "CAN" },
];

function pending(currentId: number): RoundState {
  return {
    phase: "pending",
    currentId,
    wasCorrect: null,
    gaveUp: false,
    hintsShown: 0,
    usedIds: new Set([currentId]),
    acceptedName: null,
  };
}

describe("createInitialRound", () => {
  it("starts pending with 0 hints, current in used", () => {
    const s = createInitialRound(P);
    expect(s.phase).toBe("pending");
    expect(s.hintsShown).toBe(0);
    expect(s.gaveUp).toBe(false);
    expect(s.usedIds.has(s.currentId)).toBe(true);
  });
});

describe("roundReducer — guessing", () => {
  it("correct guess with 0 hints scores as 'none'", () => {
    const n = roundReducer(pending(1), { type: "guess", guess: "sidney crosby" }, P);
    expect(n).toMatchObject({ phase: "answered", wasCorrect: true });
    expect(resultBucket(n)).toBe("none");
  });

  it("wrong guess reveals hint 1 and stays pending", () => {
    const n = roundReducer(pending(1), { type: "guess", guess: "Wayne Gretzky" }, P);
    expect(n.phase).toBe("pending");
    expect(n.hintsShown).toBe(1);
  });

  it("correct guess after 1 hint scores as 'one'", () => {
    let s = pending(1);
    s = roundReducer(s, { type: "guess", guess: "Wayne Gretzky" }, P);
    s = roundReducer(s, { type: "guess", guess: "Sidney Crosby" }, P);
    expect(s.phase).toBe("answered");
    expect(s.wasCorrect).toBe(true);
    expect(resultBucket(s)).toBe("one");
  });

  it("correct guess after 3 hints scores as 'three'", () => {
    let s = pending(1);
    s = roundReducer(s, { type: "guess", guess: "wrong-1" }, P);
    s = roundReducer(s, { type: "guess", guess: "wrong-2" }, P);
    s = roundReducer(s, { type: "guess", guess: "wrong-3" }, P);
    expect(s.hintsShown).toBe(3);
    expect(s.phase).toBe("pending");
    s = roundReducer(s, { type: "guess", guess: "Sidney Crosby" }, P);
    expect(resultBucket(s)).toBe("three");
  });

  it("fourth wrong guess after 3 hints scores as 'wrong'", () => {
    let s = pending(1);
    s = roundReducer(s, { type: "guess", guess: "w1" }, P);
    s = roundReducer(s, { type: "guess", guess: "w2" }, P);
    s = roundReducer(s, { type: "guess", guess: "w3" }, P);
    s = roundReducer(s, { type: "guess", guess: "w4" }, P);
    expect(s.phase).toBe("answered");
    expect(s.wasCorrect).toBe(false);
    expect(resultBucket(s)).toBe("wrong");
  });

  it("guess is a no-op when already answered", () => {
    const answered: RoundState = { ...pending(1), phase: "answered", wasCorrect: false };
    const n = roundReducer(answered, { type: "guess", guess: "Sidney Crosby" }, P);
    expect(n).toBe(answered);
  });
});

describe("roundReducer — give up", () => {
  it("give up reveals all 3 hints and scores 'wrong'", () => {
    const n = roundReducer(pending(1), { type: "giveUp" }, P);
    expect(n.phase).toBe("answered");
    expect(n.wasCorrect).toBe(false);
    expect(n.gaveUp).toBe(true);
    expect(n.hintsShown).toBe(3);
    expect(resultBucket(n)).toBe("wrong");
  });

  it("give up after 2 wrong guesses still scores 'wrong', reveals all 3", () => {
    let s = pending(1);
    s = roundReducer(s, { type: "guess", guess: "w1" }, P);
    s = roundReducer(s, { type: "guess", guess: "w2" }, P);
    expect(s.hintsShown).toBe(2);
    s = roundReducer(s, { type: "giveUp" }, P);
    expect(s.hintsShown).toBe(3);
    expect(resultBucket(s)).toBe("wrong");
  });

  it("give up is a no-op when already answered", () => {
    const answered: RoundState = { ...pending(1), phase: "answered", wasCorrect: true };
    const n = roundReducer(answered, { type: "giveUp" }, P);
    expect(n).toBe(answered);
  });
});

describe("roundReducer — next", () => {
  it("next resets hints and gaveUp, picks unused", () => {
    const s: RoundState = {
      phase: "answered",
      currentId: 1,
      wasCorrect: true,
      gaveUp: false,
      hintsShown: 2,
      usedIds: new Set([1]),
      acceptedName: "Sidney Crosby",
    };
    const n = roundReducer(s, { type: "next" }, P);
    expect(n.phase).toBe("pending");
    expect(n.hintsShown).toBe(0);
    expect(n.gaveUp).toBe(false);
    expect(n.wasCorrect).toBeNull();
    expect(n.acceptedName).toBeNull();
    expect(n.currentId).not.toBe(1);
  });

  it("next resets usedIds when everyone has been used", () => {
    const s: RoundState = {
      phase: "answered",
      currentId: 3,
      wasCorrect: true,
      gaveUp: false,
      hintsShown: 0,
      usedIds: new Set([1, 2, 3]),
      acceptedName: "Nathan MacKinnon",
    };
    const n = roundReducer(s, { type: "next" }, P);
    expect(n.usedIds.size).toBe(1);
  });
});

describe("roundReducer — arc twins", () => {
  const sedinStints = [
    { season: "20002001", team: "VAN", gamesPlayed: 82 },
    { season: "20012002", team: "VAN", gamesPlayed: 79 },
  ];
  const daniel: Player = { id: 1, name: "Daniel Sedin", position: "L", seasons: sedinStints, pools: ["allTime"], careerPoints: 1000, birthCountry: "SWE" };
  const henrik: Player = { id: 2, name: "Henrik Sedin", position: "C", seasons: sedinStints, pools: ["allTime"], careerPoints: 1000, birthCountry: "SWE" };

  it("credits a correct guess of an arc-twin's name", () => {
    const players = [daniel, henrik];
    const n = roundReducer(pending(daniel.id), { type: "guess", guess: "Henrik Sedin" }, players);
    expect(n.wasCorrect).toBe(true);
    expect(resultBucket(n)).toBe("none");
  });

  it("records the twin the user guessed on acceptedName (canonical form)", () => {
    const players = [daniel, henrik];
    const n = roundReducer(pending(daniel.id), { type: "guess", guess: "henrik sedin" }, players);
    expect(n.acceptedName).toBe("Henrik Sedin");
  });

  it("records the target's own name when the user guesses the target", () => {
    const players = [daniel, henrik];
    const n = roundReducer(pending(daniel.id), { type: "guess", guess: "Daniel Sedin" }, players);
    expect(n.acceptedName).toBe("Daniel Sedin");
  });

  it("does not accept a non-twin's name", () => {
    const solo: Player = { id: 1, name: "Solo Player", position: "C", seasons: [{ season: "20002001", team: "VAN", gamesPlayed: 82 }], pools: ["allTime"], careerPoints: 500, birthCountry: "CAN" };
    const other: Player = { id: 2, name: "Other Player", position: "C", seasons: [{ season: "20002001", team: "TOR", gamesPlayed: 82 }], pools: ["allTime"], careerPoints: 500, birthCountry: "CAN" };
    const n = roundReducer(pending(solo.id), { type: "guess", guess: "Other Player" }, [solo, other]);
    expect(n.phase).toBe("pending");
    expect(n.wasCorrect).toBeNull();
    expect(n.hintsShown).toBe(1);
  });
});
