import type { Player } from "./types.ts";

export async function loadPlayers(): Promise<Player[]> {
  const res = await fetch("/data/players.json");
  if (!res.ok) {
    throw new Error(`Failed to load players.json: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Player[];
}
