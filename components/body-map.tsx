"use client";

import { useEffect, useState } from "react";
import type { Muscle, RecoveryState } from "@/lib/types";
import { MUSCLE_LABEL, MUSCLES } from "@/lib/types";

const FILL: Record<RecoveryState, string> = {
  fresh: "#22CD94",
  recovering: "var(--recovery-recovering)",
  fatigued: "var(--recovery-fatigued)",
};

const SELECTED = "#767676";
const SKIN = "var(--muted)";

type Figure = {
  viewBox: string;
  body: string[];
  muscles: { muscle: Muscle; paths: string[] }[];
};

const cache = new Map<string, Figure>();

function muscleFromGroup(id: string): Muscle | null {
  const key = id.replace(/\s+/g, "").toLowerCase();
  return MUSCLES.find((muscle) => muscle.toLowerCase() === key) ?? null;
}

function parseFigure(markup: string): Figure {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.querySelector("svg");
  const body: string[] = [];
  const grouped = new Map<Muscle, string[]>();

  for (const group of doc.querySelectorAll("g[id]")) {
    const id = group.getAttribute("id") ?? "";
    const paths = [...group.children].flatMap((child) =>
      child.localName === "path" ? [child.getAttribute("d") ?? ""] : [],
    );
    if (paths.length === 0) continue;
    if (id === "Body") {
      body.push(...paths);
      continue;
    }
    const muscle = muscleFromGroup(id);
    if (!muscle) continue;
    const list = grouped.get(muscle) ?? [];
    list.push(...paths);
    grouped.set(muscle, list);
  }

  return {
    viewBox: svg?.getAttribute("viewBox") ?? "0 0 470 940",
    body,
    muscles: [...grouped.entries()].map(([muscle, paths]) => ({ muscle, paths })),
  };
}

function useFigure(side: "front" | "back") {
  const [figure, setFigure] = useState<Figure | null>(cache.get(side) ?? null);
  useEffect(() => {
    const cached = cache.get(side);
    if (cached) {
      setFigure(cached);
      return;
    }
    setFigure(null);
    let cancel = false;
    fetch(`/svg/muscles/${side}.svg`)
      .then((response) => response.text())
      .then((markup) => {
        const next = parseFigure(markup);
        cache.set(side, next);
        if (!cancel) setFigure(next);
      });
    return () => {
      cancel = true;
    };
  }, [side]);
  return figure;
}

function MusclePaths({
  muscle,
  paths,
  state,
  selected,
  onPick,
}: {
  muscle: Muscle;
  paths: string[];
  state: RecoveryState;
  selected: boolean;
  onPick: (muscle: Muscle) => void;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={MUSCLE_LABEL[muscle]}
      aria-pressed={selected}
      className="cursor-pointer outline-none hover:brightness-110"
      onClick={() => onPick(muscle)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick(muscle);
        }
      }}
    >
      <title>{MUSCLE_LABEL[muscle]}</title>
      {paths.map((d, index) => (
        <path
          key={`${muscle}-${index}`}
          d={d}
          fill={selected ? SELECTED : FILL[state]}
        />
      ))}
    </g>
  );
}

export function BodyMap({
  side,
  states,
  onPick,
  picked = null,
}: {
  side: "front" | "back";
  states: Record<Muscle, RecoveryState>;
  onPick: (muscle: Muscle) => void;
  picked?: Muscle | null;
}) {
  const figure = useFigure(side);
  if (!figure) return <div className="mx-auto h-[26rem] w-40" />;

  return (
    <svg viewBox={figure.viewBox} className="mx-auto h-[26rem] w-auto" role="img" aria-label="Muscle recovery">
      {figure.body.map((d, index) => (
        <path key={`body-${index}`} d={d} fill={SKIN} />
      ))}
      {figure.muscles.map(({ muscle, paths }) => (
        <MusclePaths
          key={muscle}
          muscle={muscle}
          paths={paths}
          state={states[muscle]}
          selected={picked === muscle}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}
