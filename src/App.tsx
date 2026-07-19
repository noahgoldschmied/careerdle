import { useEffect, useMemo, useReducer, useState } from "react";
import "./App.css";
import type { Mode, Player } from "./types.ts";
import { loadPlayers } from "./data.ts";
import { createInitialRound, roundReducer } from "./game.ts";
import { derivePool } from "./pools.ts";
import { StatsHeader } from "./components/StatsHeader.tsx";
import { RoundView } from "./components/RoundView.tsx";
import { formatCountry } from "./countries.ts";

function App() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("allTime");

  useEffect(() => {
    loadPlayers()
      .then(setPlayers)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="app-status">Failed to load: {error}</div>;
  if (!players) return <div className="app-status">Loading…</div>;

  return <ModedGame players={players} mode={mode} onModeChange={setMode} />;
}

interface ModedGameProps {
  players: Player[];
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

function ModedGame({ players, mode, onModeChange }: ModedGameProps) {
  const pool = useMemo(() => derivePool(players, mode), [players, mode]);
  // key={mode} remounts Game on mode change → fresh initial round, 0/0 stats.
  return (
    <Game
      key={mode}
      pool={pool}
      mode={mode}
      onModeChange={onModeChange}
    />
  );
}

interface GameProps {
  pool: Player[];
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

function Game({ pool, mode, onModeChange }: GameProps) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof createInitialRound>, a: Parameters<typeof roundReducer>[1]) =>
      roundReducer(s, a, pool),
    pool,
    createInitialRound,
  );
  const current = pool.find((p) => p.id === state.currentId)!;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const stat = current.position === "G"
      ? `wins: ${current.careerWins ?? 0}`
      : `pts: ${current.careerPoints}`;
    console.log(
      `[dev] answer: ${current.name} | pos: ${current.position} | ${stat} | country: ${formatCountry(current.birthCountry)}`,
    );
  }, [current]);

  return (
    <div className="app">
      <StatsHeader buckets={state.buckets} />
      <main>
        <RoundView
          player={current}
          players={pool}
          state={state}
          mode={mode}
          poolSize={pool.length}
          onModeChange={onModeChange}
          onGuess={(name) => dispatch({ type: "guess", guess: name })}
          onRevealHint={() => dispatch({ type: "revealHint" })}
          onGiveUp={() => dispatch({ type: "giveUp" })}
          onNext={() => dispatch({ type: "next" })}
        />
      </main>
    </div>
  );
}

export default App;
