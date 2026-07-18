import { getTeam } from "../teams.ts";

interface Props {
  triCode: string;
  startYear: number;
  endYear: number;
  joinedMidSeason: boolean;
  leftMidSeason: boolean;
}

function shortYear(y: number): string {
  return String(y).slice(2);
}

export function TeamChip({ triCode, startYear, endYear, joinedMidSeason, leftMidSeason }: Props) {
  const meta = getTeam(triCode);
  // Trim a mid-season arrival/departure off the displayed range: a player traded IN
  // during a season wasn't there in the fall (drop 1 from startYear); traded OUT wasn't
  // there in the spring (drop 1 from endYear). Prevents adjacent chips from overlapping
  // on the trade year.
  const displayStart = startYear + (joinedMidSeason ? 1 : 0);
  const displayEnd = endYear - (leftMidSeason ? 1 : 0);
  const label = displayStart === displayEnd
    ? `${triCode} '${shortYear(displayStart)}`
    : `${triCode} '${shortYear(displayStart)}–'${shortYear(displayEnd)}`;
  return (
    <div className="team-chip" style={{ borderColor: meta.color }}>
      {meta.hasLogo ? (
        <img className="team-chip__logo" src={`/logos/${triCode}.svg`} alt={meta.name} />
      ) : (
        <div className="team-chip__tri" style={{ background: meta.color }}>{triCode}</div>
      )}
      <div className="team-chip__label">{label}</div>
    </div>
  );
}
