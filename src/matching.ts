import type { Player } from "./types.ts";

export function matchPlayers(query: string, players: Player[], limit = 8): Player[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exactWord: Player[] = [];
  const wordBoundary: Player[] = [];
  const prefix: Player[] = [];
  const contains: Player[] = [];
  for (const p of players) {
    const n = p.name.toLowerCase();
    const words = n.split(/\s+/);
    if (words.some(w => w === q)) exactWord.push(p);
    else if (words.some(w => w.startsWith(q))) wordBoundary.push(p);
    else if (n.startsWith(q)) prefix.push(p);
    else if (n.includes(q)) contains.push(p);
    if (exactWord.length + wordBoundary.length + prefix.length + contains.length >= limit * 4) break;
  }
  return [...exactWord, ...wordBoundary, ...prefix, ...contains].slice(0, limit);
}
