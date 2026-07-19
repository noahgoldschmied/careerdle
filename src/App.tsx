import { useEffect, useMemo, useReducer, useState } from "react";
import "./App.css";
import type { Mode, Player } from "./types.ts";
import { loadPlayers } from "./data.ts";
import type { Bucket, RoundAction } from "./game.ts";
import { createInitialRound, emptyBuckets, resultBucket, roundReducer } from "./game.ts";
import { derivePool } from "./pools.ts";
import { StatsHeader } from "./components/StatsHeader.tsx";
import { RoundView } from "./components/RoundView.tsx";
import { formatCountry } from "./countries.ts";

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

  return <ModedGame players={players} />;
}

interface ModedGameProps {
  players: Player[];
}

type ScoresByMode = Record<Mode, Record<Bucket, number>>;

function ModedGame({ players }: ModedGameProps) {
  const [activeMode, setActiveMode] = useState<Mode>("allTime");
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [scores, setScores] = useState<ScoresByMode>(() => ({
    allTime: emptyBuckets(),
    activeEasy: emptyBuckets(),
    activeHard: emptyBuckets(),
  }));

  const pool = useMemo(() => derivePool(players, activeMode), [players, activeMode]);

  const requestMode = (next: Mode) => {
    setPendingMode(next === activeMode ? null : next);
  };
  const commitPendingMode = () => {
    if (pendingMode) {
      setActiveMode(pendingMode);
      setPendingMode(null);
    }
  };
  const recordResult = (bucket: Bucket) => {
    setScores((s) => ({
      ...s,
      [activeMode]: { ...s[activeMode], [bucket]: s[activeMode][bucket] + 1 },
    }));
  };

  // key={activeMode} remounts Game on committed mode change → fresh initial
  // round from the new pool. Scores survive because they live here.
  return (
    <Game
      key={activeMode}
      pool={pool}
      mode={activeMode}
      pendingMode={pendingMode}
      buckets={scores[activeMode]}
      onModeRequest={requestMode}
      onCommitMode={commitPendingMode}
      onRoundResult={recordResult}
    />
  );
}

interface GameProps {
  pool: Player[];
  mode: Mode;
  pendingMode: Mode | null;
  buckets: Record<Bucket, number>;
  onModeRequest: (mode: Mode) => void;
  onCommitMode: () => void;
  onRoundResult: (bucket: Bucket) => void;
}

function Game({ pool, mode, pendingMode, buckets, onModeRequest, onCommitMode, onRoundResult }: GameProps) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof createInitialRound>, a: Parameters<typeof roundReducer>[1]) =>
      roundReducer(s, a, pool),
    pool,
    createInitialRound,
  );
  const current = pool.find((p) => p.id === state.currentId)!;

  const handleAction = (action: RoundAction) => {
    const nextState = roundReducer(state, action, pool);
    if (state.phase === "pending" && nextState.phase === "answered") {
      onRoundResult(resultBucket(nextState));
    }
    if (action.type === "next" && state.phase === "answered") {
      // Committing the pending mode swaps the parent's activeMode, which
      // remounts this Game with a fresh initial round from the new pool.
      // The dispatched "next" here becomes moot in that case.
      onCommitMode();
    }
    dispatch(action);
  };

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
      <StatsHeader buckets={buckets} mode={mode} />
      <main>
        <RoundView
          player={current}
          players={pool}
          state={state}
          mode={mode}
          pendingMode={pendingMode}
          poolSize={pool.length}
          onModeChange={onModeRequest}
          onGuess={(name) => handleAction({ type: "guess", guess: name })}
          onRevealHint={() => handleAction({ type: "revealHint" })}
          onGiveUp={() => handleAction({ type: "giveUp" })}
          onNext={() => handleAction({ type: "next" })}
        />
      </main>
    </div>
  );
}

export default App;
