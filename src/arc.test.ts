import { describe, it, expect } from "vitest";
import { collapseArc, seasonStartYear, seasonEndYear, arcSignature, isDistinctiveArc } from "./arc.ts";
import type { SeasonStint } from "./types.ts";

const s = (season: string, team: string, gp = 50, stintOrder?: number): SeasonStint => ({
  season, team, gamesPlayed: gp, ...(stintOrder !== undefined ? { stintOrder } : {}),
});

describe("season helpers", () => {
  it("parses years", () => {
    expect(seasonStartYear("20222023")).toBe(2022);
    expect(seasonEndYear("20222023")).toBe(2023);
  });
});

describe("collapseArc", () => {
  it("collapses consecutive same-team seasons", () => {
    const arc = collapseArc([s("20202021", "TOR"), s("20212022", "TOR"), s("20222023", "TOR")]);
    expect(arc).toHaveLength(1);
    expect(arc[0]).toMatchObject({ team: "TOR", startYear: 2020, endYear: 2023, midSeasonTrade: false });
  });

  it("splits on team change", () => {
    const arc = collapseArc([s("20202021", "TOR"), s("20212022", "BOS")]);
    expect(arc.map((c) => c.team)).toEqual(["TOR", "BOS"]);
  });

  it("splits franchise moves (different tricodes)", () => {
    const arc = collapseArc([s("19941995", "QUE"), s("19951996", "COL")]);
    expect(arc.map((c) => c.team)).toEqual(["QUE", "COL"]);
  });

  it("emits adjacent chips for mid-season trades and flags midSeasonTrade", () => {
    const arc = collapseArc([
      s("20212022", "BUF", 21, 1),
      s("20212022", "VGK", 34, 2),
      s("20222023", "VGK"),
    ]);
    expect(arc).toHaveLength(2);
    expect(arc[0]).toMatchObject({ team: "BUF", startYear: 2021, endYear: 2022, midSeasonTrade: true });
    expect(arc[1]).toMatchObject({ team: "VGK", startYear: 2021, endYear: 2023, midSeasonTrade: true });
  });

  it("collapses across gap seasons if team is the same", () => {
    const arc = collapseArc([s("20032004", "COL"), s("20052006", "COL")]); // lockout gap
    expect(arc).toHaveLength(1);
    expect(arc[0]).toMatchObject({ team: "COL", startYear: 2003, endYear: 2006 });
  });

  it("merges a trade stint into the previous same-team chip", () => {
    // Prior full CHI season, then traded FROM CHI to PHI mid next season.
    // Should NOT emit a duplicate CHI chip for the trade stint.
    const arc = collapseArc([
      s("19981999", "CHI"),
      s("19992000", "CHI"),
      s("20002001", "CHI", 40, 1),
      s("20002001", "PHI", 30, 2),
    ]);
    expect(arc.map((c) => c.team)).toEqual(["CHI", "PHI"]);
    expect(arc[0]).toMatchObject({ team: "CHI", startYear: 1998, endYear: 2001, midSeasonTrade: true });
    expect(arc[1]).toMatchObject({ team: "PHI", startYear: 2000, endYear: 2001, midSeasonTrade: true });
  });

  it("keeps A→B→A intra-season stints as three chips", () => {
    const arc = collapseArc([
      s("20222023", "NSH", 20, 1),
      s("20222023", "MTL", 30, 2),
      s("20222023", "NSH", 10, 3),
    ]);
    expect(arc.map((c) => c.team)).toEqual(["NSH", "MTL", "NSH"]);
  });
});

describe("arcSignature", () => {
  it("returns identical signatures for identical stint sequences", () => {
    const stints = [
      { season: "20002001", team: "VAN", gamesPlayed: 82 },
      { season: "20012002", team: "VAN", gamesPlayed: 79 },
    ];
    expect(arcSignature(stints)).toBe(arcSignature([...stints]));
  });

  it("differs when teams differ", () => {
    const a = [{ season: "20002001", team: "VAN", gamesPlayed: 82 }];
    const b = [{ season: "20002001", team: "TOR", gamesPlayed: 82 }];
    expect(arcSignature(a)).not.toBe(arcSignature(b));
  });

  it("differs when year ranges differ", () => {
    const a = [{ season: "20002001", team: "VAN", gamesPlayed: 82 }];
    const b = [{ season: "20012002", team: "VAN", gamesPlayed: 82 }];
    expect(arcSignature(a)).not.toBe(arcSignature(b));
  });

  it("differs when a mid-season trade splits the arc", () => {
    const soloVan = [{ season: "20002001", team: "VAN", gamesPlayed: 82 }];
    const traded = [
      { season: "20002001", team: "VAN", gamesPlayed: 40, stintOrder: 1 },
      { season: "20002001", team: "TOR", gamesPlayed: 42, stintOrder: 2 },
    ];
    expect(arcSignature(soloVan)).not.toBe(arcSignature(traded));
  });
});

describe("isDistinctiveArc", () => {
  it("rejects a single team, single season stub (rookie call-up)", () => {
    // Taylor Makar's real arc: only COL 25-26.
    expect(isDistinctiveArc([s("20252026", "COL")])).toBe(false);
  });

  it("rejects a single team spanning only two seasons", () => {
    expect(isDistinctiveArc([s("20242025", "COL"), s("20252026", "COL")])).toBe(false);
  });

  it("accepts a single team spanning three seasons", () => {
    expect(isDistinctiveArc([
      s("20232024", "NYR"),
      s("20242025", "NYR"),
      s("20252026", "NYR"),
    ])).toBe(true);
  });

  it("accepts a long single-team career (Sedin-style)", () => {
    const stints = Array.from({ length: 18 }, (_, i) => {
      const y = 2000 + i;
      return s(`${y}${y + 1}`, "VAN");
    });
    expect(isDistinctiveArc(stints)).toBe(true);
  });

  it("accepts multi-team arcs regardless of length", () => {
    // Traded mid-season, one season total — still distinctive because two teams.
    expect(isDistinctiveArc([
      s("20252026", "TOR", 40, 1),
      s("20252026", "BOS", 42, 2),
    ])).toBe(true);
  });

  it("accepts a two-team career even when each stint is short", () => {
    expect(isDistinctiveArc([s("20242025", "TOR"), s("20252026", "BOS")])).toBe(true);
  });

  it("returns false for an empty stint list", () => {
    expect(isDistinctiveArc([])).toBe(false);
  });
});
