import type { Mode } from "../types.ts";
import { poolLabel } from "../pools.ts";

const MODES: Mode[] = ["allTime", "activeEasy", "activeHard"];

interface Props {
  mode: Mode;
  poolSize: number;
  onChange: (mode: Mode) => void;
}

export function ModeSelector({ mode, poolSize, onChange }: Props) {
  return (
    <div className="mode-selector">
      <div className="mode-selector__row" role="tablist" aria-label="Player pool">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`mode-selector__btn${mode === m ? " is-selected" : ""}`}
            onClick={() => {
              if (mode !== m) onChange(m);
            }}
          >
            {poolLabel(m)}
          </button>
        ))}
      </div>
      <div className="mode-selector__caption">{poolSize} players</div>
    </div>
  );
}
