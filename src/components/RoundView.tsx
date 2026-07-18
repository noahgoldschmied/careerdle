import type { Player } from "../types.ts";
import type { RoundState } from "../game.ts";
import { CareerArc } from "./CareerArc.tsx";
import { GuessInput } from "./GuessInput.tsx";

interface Props {
  player: Player;
  players: Player[];
  state: RoundState;
  onGuess: (name: string) => void;
  onReveal: () => void;
  onNext: () => void;
}

export function RoundView({ player, players, state, onGuess, onReveal, onNext }: Props) {
  const answered = state.phase === "answered";
  return (
    <section className="round">
      <CareerArc stints={player.seasons} />
      <div className="round__controls">
        <GuessInput players={players} disabled={answered} onGuess={onGuess} />
        <button type="button" onClick={onReveal} disabled={answered}>Reveal</button>
      </div>
      {answered && (
        <div className={`round__result ${state.wasCorrect ? "is-correct" : "is-wrong"}`}>
          <div>{state.wasCorrect ? "Correct!" : "Wrong."} The answer was <strong>{player.name}</strong>.</div>
          <button type="button" onClick={onNext}>Next player →</button>
        </div>
      )}
    </section>
  );
}
