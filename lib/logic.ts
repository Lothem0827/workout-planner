import type {
  LibraryExercise,
  Muscle,
  PlannedExercise,
  Prescription,
  Program,
  RecoveryState,
  Session,
  SessionExercise,
  SetLog,
  WeekPlan,
  WeekSlot,
} from "./types";
import { LOWER, MUSCLE_LABEL } from "./types";
import { formatLoad, formatWeight } from "./units";

export function uid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function exerciseTitle(name: string) {
  return name.replace(/[A-Za-z]+/g, (word) =>
    word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word,
  );
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Half-life of one set of fatigue. Three direct sets are fresh (score < 0.25) after ~3.6 half-lives.
const HALF_HOURS: Record<Muscle, number> = {
  abs: 7,
  calves: 10,
  biceps: 14,
  shoulders: 14,
  triceps: 17,
  chest: 17,
  lats: 17,
  traps: 17,
  glutes: 17,
  hamstrings: 20,
  quads: 24,
  lowerBack: 24,
};

export function e1rm(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

export function byIdMap(exercises: LibraryExercise[]) {
  return new Map(exercises.map((exercise) => [exercise.id, exercise]));
}

export function primariesOf(
  exercises: { exerciseId: string }[],
  map: Map<string, LibraryExercise>,
) {
  const muscles = new Set<Muscle>();
  for (const exercise of exercises) {
    const lib = map.get(exercise.exerciseId);
    if (lib) muscles.add(lib.primary);
  }
  return muscles;
}

export function finishedSessions(sessions: Session[]) {
  return sessions
    .filter((session) => session.status === "finished" && session.finishedAt)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
}

export function fatigueScore(
  muscle: Muscle,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
  now = Date.now(),
) {
  let score = 0;
  for (const session of finishedSessions(sessions)) {
    const hours = (now - (session.finishedAt ?? now)) / 36e5;
    const decay = 0.5 ** (hours / HALF_HOURS[muscle]);
    for (const exercise of session.exercises) {
      const lib = map.get(exercise.exerciseId);
      if (!lib) continue;
      const done = exercise.sets.filter((set) => set.done).length;
      if (!done) continue;
      const weight =
        lib.primary === muscle ? 1 : lib.secondary.includes(muscle) ? 0.4 : 0;
      score += done * weight * decay;
    }
  }
  return score;
}

export function recoveryState(score: number): RecoveryState {
  if (score > 0.65) return "fatigued";
  if (score >= 0.25) return "recovering";
  return "fresh";
}

export function readyInHours(muscle: Muscle, score: number) {
  if (score <= 0.25) return 0;
  return HALF_HOURS[muscle] * Math.log2(score / 0.25);
}

export function lastTrained(
  muscle: Muscle,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
) {
  let latest = 0;
  for (const session of finishedSessions(sessions)) {
    const hit = session.exercises.some(
      (exercise) => map.get(exercise.exerciseId)?.primary === muscle,
    );
    if (hit && (session.finishedAt ?? 0) > latest) latest = session.finishedAt ?? 0;
  }
  return latest || null;
}

export function slotsFromProgram(program: Program): WeekSlot[] {
  return program.days.map((day) => ({
    id: uid(),
    sourceDayId: day.id,
    name: day.name,
    exercises: day.exercises.map((exercise) => ({ ...exercise, id: uid() })),
    status: "pending" as const,
  }));
}

export function newWeek(program: Program, pass: number): WeekPlan {
  return {
    id: uid(),
    programId: program.id,
    pass,
    slots: slotsFromProgram(program),
  };
}

function slotPrimaries(
  slot: WeekSlot,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
) {
  if (slot.status === "done" && slot.sessionId) {
    const session = sessions.find((item) => item.id === slot.sessionId);
    if (session) return primariesOf(session.exercises, map);
  }
  return primariesOf(slot.exercises, map);
}

export function templateFloors(
  program: Program,
  map: Map<string, LibraryExercise>,
) {
  const counts = new Map<Muscle, number>();
  for (const day of program.days) {
    for (const muscle of primariesOf(day.exercises, map)) {
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    }
  }
  const floors = new Map<Muscle, number>();
  for (const [muscle, count] of counts) {
    floors.set(muscle, count >= 2 ? 2 : count);
  }
  return floors;
}

const COMPOUNDS = new Set([
  "horizontalPress",
  "verticalPress",
  "squat",
  "hinge",
  "horizontalPull",
  "verticalPull",
]);

export interface FoldPreview {
  slots: WeekSlot[];
  droppedNames: string[];
  rows: { name: string; kept: string[]; added: string[] }[];
  counts: { muscle: Muscle; label: string; count: number; floor: number }[];
  gaps: string[];
}

export function foldWeek(
  week: WeekPlan,
  program: Program,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
  remaining: number,
): FoldPreview {
  const done = week.slots.filter((slot) => slot.status === "done");
  const pending = week.slots.filter((slot) => slot.status === "pending");
  const count = Math.max(0, Math.min(remaining, pending.length));
  const kept = pending.slice(0, count).map((slot) => ({
    ...slot,
    id: uid(),
    exercises: slot.exercises.map((exercise) => ({ ...exercise, id: uid() })),
  }));
  const dropped = pending.slice(count);
  const addedCount = new Map<string, number>();
  const addedNames = new Map<string, string[]>();
  const keptNames = new Map<string, string[]>();
  for (const slot of kept) {
    addedCount.set(slot.id, 0);
    addedNames.set(slot.id, []);
    keptNames.set(
      slot.id,
      slot.exercises.map((exercise) => map.get(exercise.exerciseId)?.name ?? "Exercise"),
    );
  }

  const floors = templateFloors(program, map);
  const hits = (muscle: Muscle) => {
    let total = 0;
    for (const slot of done) {
      if (slotPrimaries(slot, sessions, map).has(muscle)) total += 1;
    }
    for (const slot of kept) {
      if (primariesOf(slot.exercises, map).has(muscle)) total += 1;
    }
    return total;
  };

  const gaps: string[] = [];
  for (const [muscle, floor] of floors) {
    let guard = 0;
    while (hits(muscle) < floor && guard < 8) {
      guard += 1;
      const candidates: { exercise: PlannedExercise; compound: boolean }[] = [];
      for (const slot of dropped) {
        for (const exercise of slot.exercises) {
          const lib = map.get(exercise.exerciseId);
          if (!lib || lib.primary !== muscle) continue;
          candidates.push({
            exercise,
            compound: COMPOUNDS.has(lib.pattern),
          });
        }
      }
      candidates.sort((a, b) => Number(b.compound) - Number(a.compound));
      const targets = kept
        .filter(
          (slot) =>
            !primariesOf(slot.exercises, map).has(muscle) &&
            (addedCount.get(slot.id) ?? 0) < 2,
        )
        .sort((a, b) => a.exercises.length - b.exercises.length);
      const pick = candidates.find(
        (candidate) =>
          targets[0] &&
          !targets[0].exercises.some(
            (exercise) => exercise.exerciseId === candidate.exercise.exerciseId,
          ),
      );
      if (!pick || !targets[0]) {
        gaps.push(MUSCLE_LABEL[muscle]);
        break;
      }
      const target = targets[0];
      target.exercises.push({ ...pick.exercise, id: uid() });
      addedCount.set(target.id, (addedCount.get(target.id) ?? 0) + 1);
      const name = map.get(pick.exercise.exerciseId)?.name ?? "Exercise";
      addedNames.get(target.id)?.push(name);
    }
  }

  const counts = [...floors.entries()].map(([muscle, floor]) => ({
    muscle,
    label: MUSCLE_LABEL[muscle],
    count: hits(muscle),
    floor,
  }));

  return {
    slots: [...done, ...kept],
    droppedNames: dropped.map((slot) => slot.name),
    rows: kept.map((slot) => ({
      name: slot.name,
      kept: keptNames.get(slot.id) ?? [],
      added: addedNames.get(slot.id) ?? [],
    })),
    counts,
    gaps,
  };
}

export function scoreForSlot(
  slot: WeekSlot,
  map: Map<string, LibraryExercise>,
  sessions: Session[],
) {
  let max = 0;
  let fatigued = 0;
  for (const muscle of primariesOf(slot.exercises, map)) {
    const score = fatigueScore(muscle, sessions, map);
    max = Math.max(max, score);
    if (recoveryState(score) === "fatigued") fatigued += 1;
  }
  return { fatigued, max, notRecommended: fatigued > 0 };
}

export function pickToday(week: WeekPlan | null, map: Map<string, LibraryExercise>, sessions: Session[]) {
  if (!week) return null;
  const pending = week.slots.filter((slot) => slot.status === "pending");
  if (!pending.length) return null;
  const ranked = pending.map((slot) => ({
    slot,
    ...scoreForSlot(slot, map, sessions),
  }));
  const fresh = ranked.find((item) => !item.notRecommended);
  if (fresh) return fresh;
  return [...ranked].sort(
    (a, b) => a.fatigued - b.fatigued || a.max - b.max,
  )[0];
}

export function lastLoggedExercise(exerciseId: string, sessions: Session[]) {
  const previous = [...finishedSessions(sessions)]
    .reverse()
    .find((session) =>
      session.exercises.some(
        (exercise) =>
          exercise.exerciseId === exerciseId &&
          exercise.sets.some((set) => set.done && set.weight != null && set.reps != null),
      ),
    );
  return previous?.exercises.find((item) => item.exerciseId === exerciseId) ?? null;
}

export function lastPerformance(
  exerciseId: string,
  sessions: Session[],
) {
  return (
    lastLoggedExercise(exerciseId, sessions)?.sets.filter(
      (set) => set.done && set.weight != null && set.reps != null,
    ) ?? []
  );
}

export interface WeightSuggestion {
  weight: number;
  repMin: number;
  repMax: number;
  increased: boolean;
  bump: number;
}

export function suggestedWeightKg(
  exercise: SessionExercise,
  lib: LibraryExercise | undefined,
  sessions: Session[],
): WeightSuggestion | null {
  const last = lastLoggedExercise(exercise.exerciseId, sessions);
  if (!last || !lib) return null;
  const previous = last.sets.filter(
    (set) => set.done && set.weight != null && set.reps != null,
  );
  if (!previous.length) return null;
  const top = Math.max(...previous.map((set) => set.weight ?? 0));
  const increased = previous.every((set) => (set.reps ?? 0) >= last.repMax);
  const bump = LOWER.includes(lib.primary) ? 5 : 2.5;
  return {
    weight: increased ? top + bump : top,
    repMin: last.repMin,
    repMax: last.repMax,
    increased,
    bump,
  };
}

export function nextTargetLine(target: WeightSuggestion, unit: "kg" | "lb") {
  const load = `${formatWeight(target.weight, unit)} ${unit}`;
  if (target.increased) return `Next target ${load} (+${formatLoad(target.bump, unit)})`;
  const range =
    target.repMin === target.repMax
      ? String(target.repMin)
      : `${target.repMin}–${target.repMax}`;
  return `Next target ${load}, add reps toward ${range}`;
}

export function applyPrs(sessions: Session[]) {
  const best = new Map<string, number>();
  for (const session of finishedSessions(sessions)) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        set.pr = false;
        if (!set.done || set.weight == null || set.reps == null || set.weight <= 0) continue;
        const estimate = e1rm(set.weight, set.reps);
        const prior = best.get(exercise.exerciseId) ?? 0;
        if (estimate > prior) {
          set.pr = prior > 0;
          best.set(exercise.exerciseId, estimate);
        }
      }
    }
  }
}

export function bestE1rm(exerciseId: string, sessions: Session[]) {
  let best = 0;
  let weight = 0;
  let reps = 0;
  for (const session of finishedSessions(sessions)) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!set.done || set.weight == null || set.reps == null) continue;
        const estimate = e1rm(set.weight, set.reps);
        if (estimate > best) {
          best = estimate;
          weight = set.weight;
          reps = set.reps;
        }
      }
    }
  }
  return { best, weight, reps };
}

export function chartPoints(exerciseId: string, sessions: Session[]) {
  const points: { date: string; value: number }[] = [];
  for (const session of finishedSessions(sessions)) {
    let best = 0;
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!set.done || set.weight == null || set.reps == null) continue;
        best = Math.max(best, e1rm(set.weight, set.reps));
      }
    }
    if (best > 0) points.push({ date: session.date, value: best });
  }
  return points;
}

const REST_PRESET_MS = [30_000, 45_000, 60_000, 90_000, 120_000, 150_000, 180_000, 240_000, 300_000];

export function restMs(rest?: string | null) {
  const numbers = rest
    ? [...rest.matchAll(/\d+(?:\.\d+)?/g)]
        .map((match) => Number(match[0]))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  if (!numbers.length) return 90_000;
  const amount = Math.max(...numbers);
  if (rest && /sec/i.test(rest)) return Math.round(amount * 1000);
  return Math.round(amount * 60_000);
}

export function formatRestClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function restOptions(currentMs: number) {
  const values = REST_PRESET_MS.includes(currentMs)
    ? REST_PRESET_MS
    : [...REST_PRESET_MS, currentMs].sort((a, b) => a - b);
  return values.map((ms) => ({ value: String(ms), label: formatRestClock(ms) }));
}

export function workingSetCount(planned: { workingSets?: string; sets: number }) {
  const parsed = Number.parseInt(planned.workingSets ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return planned.sets;
}

function copyPrescription(planned: Prescription): Prescription {
  return {
    technique: planned.technique,
    warmupSets: planned.warmupSets,
    workingSets: planned.workingSets,
    repRange: planned.repRange,
    rirSet1: planned.rirSet1,
    rirSet2: planned.rirSet2,
    rpe: planned.rpe,
    rest: planned.rest,
    substitution1: planned.substitution1,
    substitution2: planned.substitution2,
    notes: planned.notes,
    videoUrl: planned.videoUrl,
  };
}

export function videoHref(name: string, videoUrl?: string | null) {
  if (videoUrl) return videoUrl;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
}

export function blankSets(count: number): SetLog[] {
  return Array.from({ length: count }, () => ({
    id: uid(),
    weight: null,
    reps: null,
    done: false,
  }));
}

export function activeSessionForSlot(slotId: string, sessions: Session[]) {
  return (
    sessions.find((session) => session.status === "active" && session.slotId === slotId) ??
    null
  );
}

export function activeSessionForWeek(week: WeekPlan | null, sessions: Session[]) {
  if (!week) return null;
  const matches = week.slots
    .map((slot) => activeSessionForSlot(slot.id, sessions))
    .filter((session): session is Session => session != null);
  return matches.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}

export function sessionExerciseFromPlanned(
  planned: PlannedExercise,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
): SessionExercise {
  const lib = map.get(planned.exerciseId);
  const count = workingSetCount(planned);
  const draft: SessionExercise = {
    id: uid(),
    exerciseId: planned.exerciseId,
    ...copyPrescription(planned),
    setsTarget: count,
    repMin: planned.repMin,
    repMax: planned.repMax,
    sets: blankSets(count),
  };
  const suggestion = suggestedWeightKg(draft, lib, sessions);
  if (suggestion != null) {
    draft.sets = draft.sets.map((set) => ({ ...set, weight: suggestion.weight }));
  }
  return draft;
}

export function exerciseDone(exercise: SessionExercise) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.done);
}

export function currentExerciseIndex(session: Session) {
  const open = session.exercises.findIndex((exercise) => !exerciseDone(exercise));
  return open === -1 ? Math.max(0, session.exercises.length - 1) : open;
}

export function unloggedExercises(session: Session) {
  return session.exercises.filter(
    (exercise) => exercise.sets.length > 0 && exercise.sets.every((set) => !set.done),
  );
}

/**
 * Days in the session's own week that can still receive its unlogged
 * exercises: every other pending day, never a finished or dropped one.
 */
export function carryOptions(session: Session, week: WeekPlan | null) {
  if (!week || !session.slotId) return [];
  if (!week.slots.some((slot) => slot.id === session.slotId)) return [];
  if (!unloggedExercises(session).length) return [];
  return week.slots.filter(
    (slot) => slot.id !== session.slotId && slot.status === "pending",
  );
}

/**
 * Copies exercises that were never logged onto the chosen pending day of the
 * same week. A day that already has the exercise gets a second copy, so the
 * week still holds the planned sets for that muscle.
 */
export function carryUnloggedExercises(
  session: Session,
  week: WeekPlan,
  targetSlotId: string,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
) {
  const unlogged = unloggedExercises(session);
  if (!unlogged.length) return;
  const next = week.slots.find((slot) => slot.id === targetSlotId);
  if (!next || next.status !== "pending" || next.id === session.slotId) return;
  const live = sessions.find(
    (item) => item.status === "active" && item.slotId === next.id,
  );
  for (const exercise of unlogged) {
    const planned: PlannedExercise = {
      id: uid(),
      exerciseId: exercise.exerciseId,
      sets: exercise.setsTarget,
      repMin: exercise.repMin,
      repMax: exercise.repMax,
      ...copyPrescription(exercise),
    };
    next.exercises.push(planned);
    if (live) {
      live.exercises.push(
        sessionExerciseFromPlanned(
          planned,
          sessions.filter((item) => item.id !== live.id),
          map,
        ),
      );
    }
  }
}

export function sessionFromSlot(
  slot: WeekSlot,
  sessions: Session[],
  map: Map<string, LibraryExercise>,
  weekIndex?: number,
): Session {
  const exercises: SessionExercise[] = slot.exercises.map((planned) =>
    sessionExerciseFromPlanned(planned, sessions, map),
  );
  return {
    id: uid(),
    date: todayKey(),
    name: slot.name,
    slotId: slot.id,
    weekIndex,
    status: "active",
    startedAt: Date.now(),
    exercises,
  };
}

export function volumeKg(session: Session) {
  return session.exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((sum, set) => {
        if (!set.done || set.weight == null || set.reps == null) return sum;
        return sum + set.weight * set.reps;
      }, 0)
    );
  }, 0);
}

export function doneSetCount(session: Session) {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
    0,
  );
}

export function swapRank(
  current: LibraryExercise,
  catalog: LibraryExercise[],
  otherEquipment: boolean,
) {
  return catalog
    .filter((exercise) => exercise.id !== current.id && exercise.primary === current.primary)
    .filter((exercise) => !otherEquipment || exercise.equipment !== current.equipment)
    .map((exercise) => {
      let rank = 3;
      if (exercise.pattern === current.pattern && exercise.equipment !== current.equipment) rank = 0;
      else if (exercise.pattern === current.pattern) rank = 1;
      return { exercise, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.exercise.name.localeCompare(b.exercise.name));
}
