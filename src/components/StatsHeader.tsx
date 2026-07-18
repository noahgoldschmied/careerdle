interface Props { correct: number; attempted: number; }
export function StatsHeader({ correct, attempted }: Props) {
  const pct = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);
  return (
    <header className="stats-header">
      <span className="stats-header__title">Playerdle</span>
      <span className="stats-header__score">{correct} / {attempted} ({pct}%)</span>
    </header>
  );
}
