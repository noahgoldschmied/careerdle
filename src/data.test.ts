import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPlayers } from "./data.ts";

describe("loadPlayers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed players array on 200", async () => {
    const payload = [{ id: 1, name: "Test", position: "C", seasons: [] }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    ));
    const players = await loadPlayers();
    expect(players).toEqual(payload);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("nope", { status: 500 }),
    ));
    await expect(loadPlayers()).rejects.toThrow(/500/);
  });
});
