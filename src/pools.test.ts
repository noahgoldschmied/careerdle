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
    birthCountry: "CAN",
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
    expect(poolLabel("allTime")).toBe("All-time top scorers");
    expect(poolLabel("activeEasy")).toBe("Active — Easy");
    expect(poolLabel("activeHard")).toBe("Active — Hard");
  });
});
