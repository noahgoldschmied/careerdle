import { describe, it, expect } from "vitest";
import { matchPlayers } from "./matching.ts";
import type { Player } from "./types.ts";

const p = (name: string): Player => ({ id: 0, name, position: "C", seasons: [] });

const POOL = [
  p("Sidney Crosby"),
  p("Sid Vicious"),
  p("Nathan MacKinnon"),
  p("Cale Makar"),
];

describe("matchPlayers", () => {
  it("returns [] for empty query", () => {
    expect(matchPlayers("", POOL)).toEqual([]);
    expect(matchPlayers("   ", POOL)).toEqual([]);
  });

  it("prefix matches rank before substring matches", () => {
    const results = matchPlayers("sid", POOL);
    expect(results.map((r) => r.name)).toEqual(["Sid Vicious", "Sidney Crosby"]);
  });

  it("is case-insensitive and trims", () => {
    expect(matchPlayers("  MAKAR  ", POOL).map((r) => r.name)).toEqual(["Cale Makar"]);
  });

  it("respects limit", () => {
    expect(matchPlayers("a", POOL, 2)).toHaveLength(2);
  });
});
