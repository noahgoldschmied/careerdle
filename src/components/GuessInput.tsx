import { useMemo, useState } from "react";
import type { Player } from "../types.ts";
import { matchPlayers } from "../matching.ts";

interface Props {
  players: Player[];
  disabled: boolean;
  onGuess: (name: string) => void;
}

export function GuessInput({ players, disabled, onGuess }: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const matches = useMemo(() => matchPlayers(query, players), [query, players]);

  const submit = (name: string) => {
    if (!name || disabled) return;
    onGuess(name);
    setQuery("");
    setHighlight(0);
  };

  return (
    <div className="guess-input">
      <input
        type="text"
        value={query}
        placeholder="Guess a player…"
        disabled={disabled}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
        onKeyDown={(e) => {
          if (matches.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length); }
          else if (e.key === "Enter") { e.preventDefault(); submit(matches[highlight].name); }
        }}
      />
      {matches.length > 0 && (
        <ul className="guess-input__list">
          {matches.map((m, i) => (
            <li
              key={m.id}
              className={i === highlight ? "is-highlight" : ""}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => submit(m.name)}
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
