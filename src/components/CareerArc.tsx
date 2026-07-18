import type { SeasonStint } from "../types.ts";
import { collapseArc } from "../arc.ts";
import { TeamChip } from "./TeamChip.tsx";

interface Props {
  stints: SeasonStint[];
}

export function CareerArc({ stints }: Props) {
  const chips = collapseArc(stints);
  return (
    <div className="career-arc">
      {chips.map((c, i) => (
        <TeamChip
          key={`${c.team}-${c.startYear}-${i}`}
          triCode={c.team}
          startYear={c.startYear}
          endYear={c.endYear}
          joinedMidSeason={c.joinedMidSeason}
          leftMidSeason={c.leftMidSeason}
        />
      ))}
    </div>
  );
}
