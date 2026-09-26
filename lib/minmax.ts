import raw from "@/data/minmax.json";
import { uid } from "./logic";
import type { LibraryExercise, Muscle, Pattern, PlannedExercise, Program, ProgramDay } from "./types";

interface RawExercise {
  name: string;
  technique: string;
  warmupSets: string;
  workingSets: string;
  repRange: string;
  rirSet1: string;
  rirSet2: string;
  rest: string;
  substitution1: string;
  substitution2: string;
  notes: string;
  videoUrl: string | null;
}

interface RawDay {
  name: string;
  exercises: RawExercise[];
}

interface RawWeek {
  week: number;
  days: RawDay[];
}

const data = raw as { name: string; demos?: Record<string, string>; weeks: RawWeek[] };

const demos = new Map(
  Object.entries(data.demos ?? {}).map(([name, url]) => [name.toLowerCase(), url]),
);

export function demoUrlFor(name: string) {
  return demos.get(name.toLowerCase()) ?? null;
}

export function youtubeEmbed(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const id =
      parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

function repsOf(range: string) {
  const parts = range.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length >= 2 && parts.every((part) => Number.isFinite(part))) {
    return { repMin: parts[0], repMax: parts[1] };
  }
  const single = Number.parseInt(range, 10);
  if (Number.isFinite(single)) return { repMin: single, repMax: single };
  return { repMin: 6, repMax: 10 };
}

export function classifyExercise(name: string): Pick<LibraryExercise, "primary" | "pattern" | "equipment"> {
  const text = name.toLowerCase();
  const equipment = text.includes("cable")
    ? "cable"
    : text.includes("db") || text.includes("dumbbell")
      ? "dumbbell"
      : text.includes("smith")
        ? "smith"
        : text.includes("machine") || text.includes("pec deck") || text.includes("leg press") || text.includes("leg curl") || text.includes("leg extension")
          ? "machine"
          : text.includes("ez")
            ? "ez bar"
            : "barbell";

  const rules: { test: RegExp; primary: Muscle; pattern: Pattern }[] = [
    { test: /calf/, primary: "calves", pattern: "calfRaise" },
    { test: /dragon flag|leg raise|crunch|plank|ab /, primary: "abs", pattern: "core" },
    { test: /curl|preacher/, primary: "biceps", pattern: "curl" },
    { test: /pressdown|pushdown|skull|overhead extension|dip/, primary: "triceps", pattern: "extension" },
    { test: /shrug/, primary: "traps", pattern: "raise" },
    { test: /y-raise|lateral|rear delt|face pull/, primary: "shoulders", pattern: "raise" },
    { test: /flye|fly|pec deck/, primary: "chest", pattern: "fly" },
    { test: /pulldown|pull-up|pullup|chin/, primary: "lats", pattern: "verticalPull" },
    { test: /row/, primary: "lats", pattern: "horizontalPull" },
    { test: /hip thrust|abduction|adduction|glute/, primary: "glutes", pattern: "hinge" },
    { test: /squat|leg press|leg extension|lunge|hack/, primary: "quads", pattern: "squat" },
    { test: /leg curl|nordic|good morning/, primary: "hamstrings", pattern: "hinge" },
    { test: /rdl|deadlift|hip thrust|glute|bridge/, primary: "glutes", pattern: "hinge" },
    { test: /overhead press|shoulder press/, primary: "shoulders", pattern: "verticalPress" },
    { test: /press|bench/, primary: "chest", pattern: "horizontalPress" },
  ];
  const hit = rules.find((rule) => rule.test.test(text));
  return {
    equipment,
    primary: hit?.primary ?? "chest",
    pattern: hit?.pattern ?? "other",
  };
}

function plannedFrom(exercise: RawExercise, exerciseId: string): PlannedExercise {
  const reps = repsOf(exercise.repRange);
  const sets = Number.parseInt(exercise.workingSets, 10);
  return {
    id: uid(),
    exerciseId,
    sets: Number.isFinite(sets) && sets > 0 ? sets : 2,
    repMin: reps.repMin,
    repMax: reps.repMax,
    technique: exercise.technique,
    warmupSets: exercise.warmupSets,
    workingSets: exercise.workingSets,
    repRange: exercise.repRange,
    rirSet1: exercise.rirSet1,
    rirSet2: exercise.rirSet2,
    rest: exercise.rest,
    substitution1: exercise.substitution1,
    substitution2: exercise.substitution2,
    notes: exercise.notes,
    videoUrl: exercise.videoUrl,
  };
}

export function minmaxNames() {
  const names = new Set<string>();
  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const exercise of day.exercises) {
        names.add(exercise.name);
        if (exercise.substitution1 && exercise.substitution1 !== "See Notes") names.add(exercise.substitution1);
        if (exercise.substitution2 && exercise.substitution2 !== "See Notes") names.add(exercise.substitution2);
      }
    }
  }
  return [...names];
}

export function ensureMinmaxExercises(existing: LibraryExercise[]) {
  const byName = new Map(existing.map((exercise) => [exercise.name.toLowerCase(), exercise]));
  const created: LibraryExercise[] = [];
  const updated: LibraryExercise[] = [];
  for (const name of minmaxNames()) {
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      if (existing.id.startsWith("minmax-")) {
        const classified = classifyExercise(name);
        if (
          existing.primary !== classified.primary ||
          existing.pattern !== classified.pattern ||
          existing.equipment !== classified.equipment
        ) {
          const next = { ...existing, ...classified };
          updated.push(next);
          byName.set(name.toLowerCase(), next);
        }
      }
      continue;
    }
    const classified = classifyExercise(name);
    const exercise: LibraryExercise = {
      id: `minmax-${uid()}`,
      name,
      primary: classified.primary,
      secondary: [],
      equipment: classified.equipment,
      pattern: classified.pattern,
      custom: true,
    };
    created.push(exercise);
    byName.set(name.toLowerCase(), exercise);
  }
  return { created, updated, byName };
}

export function minmaxProgram(byName: Map<string, LibraryExercise>): Program {
  const weeks = data.weeks.map((week) => ({
    week: week.week,
    days: week.days.map((day): ProgramDay => ({
      id: uid(),
      name: day.name,
      exercises: day.exercises.map((exercise) => {
        const lib = byName.get(exercise.name.toLowerCase());
        return plannedFrom(exercise, lib?.id ?? exercise.name);
      }),
    })),
  }));
  return {
    id: uid(),
    name: "Min-Max",
    builtin: "minmax",
    weekIndex: 1,
    weeks,
    days: weeks[0]?.days ?? [],
  };
}
