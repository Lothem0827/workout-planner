import raw from "@/data/essentials.json";
import { uid } from "./logic";
import { classifyExercise } from "./minmax";
import type { LibraryExercise, PlannedExercise, Program, ProgramDay } from "./types";

interface RawExercise {
  name: string;
  technique: string;
  warmupSets: string;
  workingSets: string;
  repRange: string;
  rpe: string;
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

const data = raw as { name: string; weeks: RawWeek[] };

function repsOf(range: string) {
  const parts = range.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length >= 2 && parts.every((part) => Number.isFinite(part))) {
    return { repMin: parts[0], repMax: parts[1] };
  }
  const single = Number.parseInt(range, 10);
  if (Number.isFinite(single)) return { repMin: single, repMax: single };
  return { repMin: 8, repMax: 12 };
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
    rpe: exercise.rpe,
    rest: exercise.rest,
    substitution1: exercise.substitution1,
    substitution2: exercise.substitution2,
    notes: exercise.notes,
    videoUrl: exercise.videoUrl,
  };
}

export function essentialsNames() {
  const names = new Set<string>();
  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const exercise of day.exercises) {
        if (exercise.name) names.add(exercise.name);
        if (exercise.substitution1) names.add(exercise.substitution1);
        if (exercise.substitution2) names.add(exercise.substitution2);
      }
    }
  }
  return [...names];
}

export function ensureEssentialsExercises(existing: LibraryExercise[]) {
  const byName = new Map(existing.map((exercise) => [exercise.name.toLowerCase(), exercise]));
  const created: LibraryExercise[] = [];
  for (const name of essentialsNames()) {
    if (byName.has(name.toLowerCase())) continue;
    const classified = classifyExercise(name);
    const exercise: LibraryExercise = {
      id: `essentials-${uid()}`,
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
  return { created, byName };
}

export function essentialsProgram(byName: Map<string, LibraryExercise>): Program {
  const weeks = data.weeks.map((week) => ({
    week: week.week,
    days: week.days.map((day): ProgramDay => ({
      id: uid(),
      name: day.name,
      exercises: day.exercises
        .filter((exercise) => exercise.name)
        .map((exercise) => {
          const lib = byName.get(exercise.name.toLowerCase());
          return plannedFrom(exercise, lib?.id ?? exercise.name);
        }),
    })),
  }));
  return {
    id: uid(),
    name: "Upper/Lower",
    builtin: "upper-lower",
    weekIndex: 1,
    weeks,
    days: weeks[0]?.days ?? [],
  };
}
