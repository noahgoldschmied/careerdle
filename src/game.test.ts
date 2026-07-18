import { describe, it, expect } from "vitest";
import { createInitialRound, roundReducer } from "./game.ts";
import type { Player } from "./types.ts";

const P: Player[] = [
  { id: 1, name: "Sidney Crosby", position: "C", seasons: [] },
  { id: 2, name: "Connor McDavid", position: "C", seasons: [] },
  { id: 3, name: "Nathan MacKinnon", position: "C", seasons: [] },
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
});
