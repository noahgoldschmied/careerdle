import type { Mode } from "../types.ts";
import type { Bucket } from "../game.ts";
import { poolLabel } from "../pools.ts";

interface Props {
  buckets: Record<Bucket, number>;
  mode: Mode;
}

const CELLS: { key: Bucket; label: string }[] = [
  { key: "none", label: "0" },
  { key: "one", label: "1" },
  { key: "two", label: "2" },
  { key: "three", label: "3" },
  { key: "wrong", label: "✗" },
];

export function StatsHeader({ buckets, mode }: Props) {
  return (
    <header className="stats-header">
      <div className="stats-header__title-group">
        <span className="stats-header__title">Careerdle</span>
        <span className="stats-header__mode">{poolLabel(mode)}</span>
      </div>
      <div className="stats-header__buckets">
        <span className="stats-header__buckets-label">Hints needed</span>
        {CELLS.map(({ key, label }) => (
          <span key={key} className={`stats-header__bucket stats-header__bucket--${key}`}>
            <span className="stats-header__bucket-label">{label}</span>
            <span className="stats-header__bucket-value">{buckets[key]}</span>
          </span>
        ))}
      </div>
    </header>
  );
}
