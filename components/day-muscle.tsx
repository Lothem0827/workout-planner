"use client";

import { useMuscleFigure } from "@/components/body-map";
import type { Muscle } from "@/lib/types";

const HIGHLIGHT = "#22CD94";
const DIM = "var(--muted)";

const FIGURES: { file: string; muscles: Muscle[] }[] = [
  { file: "upper-front", muscles: ["chest", "shoulders", "biceps", "abs", "traps"] },
  { file: "lower-front", muscles: ["quads", "calves", "abs"] },
  { file: "upper-back", muscles: ["lats", "traps", "shoulders", "triceps", "biceps", "lowerBack"] },
  { file: "lower-back", muscles: ["hamstrings", "glutes", "calves", "lowerBack"] },
];

export function DayMuscle({ primaries }: { primaries: Muscle[] }) {
  const counts = new Map<Muscle, number>();
  for (const muscle of primaries) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  const ranked = FIGURES.map((figure) => ({
    ...figure,
    score: figure.muscles.reduce((total, muscle) => total + (counts.get(muscle) ?? 0), 0),
  })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const figure = useMuscleFigure(best.file);
  const trained = new Set(primaries);

  if (best.score === 0 || !figure) return <div className="size-12 shrink-0 rounded-md bg-muted" />;

  return (
    <svg
      viewBox={figure.viewBox}
      className="size-12 shrink-0"
      role="img"
      aria-hidden="true"
    >
      {figure.body.map((d, index) => (
        <path key={`body-${index}`} d={d} fill={DIM} />
      ))}
      {figure.muscles.map(({ muscle, paths }) =>
        paths.map((d, index) => (
          <path key={`${muscle}-${index}`} d={d} fill={trained.has(muscle) ? HIGHLIGHT : DIM} />
        )),
      )}
    </svg>
  );
}
