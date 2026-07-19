import type { Bucket } from "../game.ts";

interface Props { buckets: Record<Bucket, number>; }

const CELLS: { key: Bucket; label: string }[] = [
  { key: "none", label: "0" },
  { key: "one", label: "1" },
  { key: "two", label: "2" },
  { key: "three", label: "3" },
  { key: "wrong", label: "✗" },
];

export function StatsHeader({ buckets }: Props) {
  return (
    <header className="stats-header">
      <span className="stats-header__title">Careerdle</span>
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
