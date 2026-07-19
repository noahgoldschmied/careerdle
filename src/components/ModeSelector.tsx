import type { Mode } from "../types.ts";
import { poolLabel } from "../pools.ts";

const MODES: Mode[] = ["allTime", "activeEasy", "activeHard"];

interface Props {
  mode: Mode;
  pendingMode: Mode | null;
  poolSize: number;
  onChange: (mode: Mode) => void;
}

export function ModeSelector({ mode, pendingMode, poolSize, onChange }: Props) {
  return (
    <div className="mode-selector">
      <div className="mode-selector__row" role="tablist" aria-label="Player pool">
        {MODES.map((m) => {
          const isActive = mode === m;
          const isPending = pendingMode === m;
          const classes = [
            "mode-selector__btn",
            isActive ? "is-selected" : "",
            isPending ? "is-pending" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={classes}
              onClick={() => onChange(m)}
            >
              {poolLabel(m)}
            </button>
          );
        })}
      </div>
      <div className="mode-selector__caption">
        {pendingMode
          ? `Switches to ${poolLabel(pendingMode)} after this round`
          : `${poolSize} players`}
      </div>
    </div>
  );
}
