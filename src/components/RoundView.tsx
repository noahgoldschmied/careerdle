import type { Mode, Player } from "../types.ts";
import type { RoundState } from "../game.ts";
import { CareerArc } from "./CareerArc.tsx";
import { GuessInput } from "./GuessInput.tsx";
import { ModeSelector } from "./ModeSelector.tsx";
import { formatCountry } from "../countries.ts";
import { arcSignature } from "../arc.ts";

interface Props {
  player: Player;
  players: Player[];
  state: RoundState;
  mode: Mode;
  poolSize: number;
  onModeChange: (mode: Mode) => void;
  onGuess: (name: string) => void;
  onRevealHint: () => void;
  onGiveUp: () => void;
  onNext: () => void;
}

interface Hint { label: string; value: string; }

const POSITION_LABELS: Record<string, string> = {
  C: "C",
  L: "LW",
  R: "RW",
  D: "D",
  G: "G",
};

function hintsFor(player: Player): Hint[] {
  const statHint: Hint = player.position === "G"
    ? { label: "Career wins", value: (player.careerWins ?? 0).toLocaleString() }
    : { label: "Career points", value: player.careerPoints.toLocaleString() };
  return [
    { label: "Position", value: POSITION_LABELS[player.position] ?? player.position },
    statHint,
    { label: "Born in", value: formatCountry(player.birthCountry) },
  ];
}

export function RoundView({
  player,
  players,
  state,
  mode,
  poolSize,
  onModeChange,
  onGuess,
  onRevealHint,
  onGiveUp,
  onNext,
}: Props) {
  const answered = state.phase === "answered";
  const allHints = hintsFor(player);
  const hints = answered ? allHints : allHints.slice(0, state.hintsShown);
  const hasArcTwin = answered && state.wasCorrect
    ? players.some((p) => p.id !== player.id && arcSignature(p.seasons) === arcSignature(player.seasons))
    : false;
  return (
    <section className="round">
      <CareerArc stints={player.seasons} />
      <ModeSelector mode={mode} poolSize={poolSize} onChange={onModeChange} />
      <div className="round__controls">
        <button
          type="button"
          className="round__hint-btn"
          onClick={onRevealHint}
          disabled={answered || state.hintsShown >= 3}
        >
          {state.hintsShown === 0 ? "Hint" : `Hint (${3 - state.hintsShown} left)`}
        </button>
        <GuessInput players={players} disabled={answered} onGuess={onGuess} />
        <button type="button" onClick={onGiveUp} disabled={answered}>Give up</button>
      </div>
      {hints.length > 0 && (
        <ul className="hints">
          {answered && <li className="hints__heading">Fun facts</li>}
          {hints.map((h) => (
            <li key={h.label} className="hints__item">
              <span className="hints__label">{h.label}:</span>
              <span className="hints__value">{h.value}</span>
            </li>
          ))}
        </ul>
      )}
      {answered && (
        <div className={`round__result ${state.wasCorrect ? "is-correct" : "is-wrong"}`}>
          <div>
            {state.wasCorrect ? (
              hasArcTwin ? (
                <>Correct! <strong>{state.acceptedName ?? player.name}</strong> shares this career arc.</>
              ) : (
                <>Correct! This player is <strong>{player.name}</strong>.</>
              )
            ) : (
              <>
                {state.gaveUp ? "Gave up." : "Wrong."} The answer was <strong>{player.name}</strong>.
              </>
            )}
          </div>
          <button type="button" onClick={onNext}>Next player →</button>
        </div>
      )}
    </section>
  );
}
