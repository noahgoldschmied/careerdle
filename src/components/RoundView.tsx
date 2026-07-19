import type { Mode, Player } from "../types.ts";
import type { RoundState } from "../game.ts";
import { CareerArc } from "./CareerArc.tsx";
import { GuessInput } from "./GuessInput.tsx";
import { ModeSelector } from "./ModeSelector.tsx";
import { formatCountry } from "../countries.ts";

interface Props {
  player: Player;
  players: Player[];
  state: RoundState;
  mode: Mode;
  poolSize: number;
  onModeChange: (mode: Mode) => void;
  onGuess: (name: string) => void;
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
  return [
    { label: "Position", value: POSITION_LABELS[player.position] ?? player.position },
    { label: "Career points", value: player.careerPoints.toLocaleString() },
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
  onGiveUp,
  onNext,
}: Props) {
  const answered = state.phase === "answered";
  const hints = hintsFor(player).slice(0, state.hintsShown);
  return (
    <section className="round">
      <CareerArc stints={player.seasons} />
      <ModeSelector mode={mode} poolSize={poolSize} onChange={onModeChange} />
      <div className="round__controls">
        <GuessInput players={players} disabled={answered} onGuess={onGuess} />
        <button type="button" onClick={onGiveUp} disabled={answered}>Give up</button>
      </div>
      {hints.length > 0 && (
        <ul className="hints">
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
            {state.wasCorrect
              ? "Correct!"
              : state.gaveUp
                ? "Gave up."
                : "Wrong."}
            {" "}The answer was <strong>{player.name}</strong>.
          </div>
          <button type="button" onClick={onNext}>Next player →</button>
        </div>
      )}
    </section>
  );
}
