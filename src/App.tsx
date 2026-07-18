import { useEffect, useReducer, useState } from "react";
import "./App.css";
import type { Player } from "./types.ts";
import { loadPlayers } from "./data.ts";
import { createInitialRound, roundReducer } from "./game.ts";
import { StatsHeader } from "./components/StatsHeader.tsx";
import { RoundView } from "./components/RoundView.tsx";

function App() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayers()
      .then(setPlayers)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="app-status">Failed to load: {error}</div>;
  if (!players) return <div className="app-status">Loading…</div>;

  return <Game players={players} />;
}

function Game({ players }: { players: Player[] }) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof createInitialRound>, a: Parameters<typeof roundReducer>[1]) =>
      roundReducer(s, a, players),
    players,
    createInitialRound,
  );
  const current = players.find((p) => p.id === state.currentId)!;

  return (
    <div className="app">
      <StatsHeader correct={state.correct} attempted={state.attempted} />
      <main>
        <RoundView
          player={current}
          players={players}
          state={state}
          onGuess={(name) => dispatch({ type: "guess", guess: name })}
          onReveal={() => dispatch({ type: "reveal" })}
          onNext={() => dispatch({ type: "next" })}
        />
      </main>
    </div>
  );
}

export default App;
