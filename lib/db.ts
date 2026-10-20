import Dexie, { type Table } from "dexie";
import catalog from "@/data/catalog.json";
import { newWeek } from "./logic";
import { ensureEssentialsExercises } from "./essentials";
import { ensureMinmaxExercises, minmaxProgram } from "./minmax";
import type {
  LibraryExercise,
  Program,
  Session,
  Settings,
  WeekPlan,
} from "./types";

class GymDB extends Dexie {
  exercises!: Table<LibraryExercise, string>;
  programs!: Table<Program, string>;
  weeks!: Table<WeekPlan, string>;
  sessions!: Table<Session, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("workout-tracker");
    this.version(1).stores({
      exercises: "id, name, primary, equipment, pattern, custom",
      programs: "id",
      weeks: "id, programId",
      sessions: "id, date, status",
      settings: "id",
    });
  }
}

export const db = new GymDB();

function isMinmax(program: Program) {
  return program.builtin === "minmax" || program.name === "Min-Max";
}

function isMinmax4x(program: Program) {
  return program.source === "minmax-4x";
}

let seeding: Promise<void> | null = null;

export function seedIfEmpty() {
  seeding ??= seedPrograms().finally(() => {
    seeding = null;
  });
  return seeding;
}

async function seedPrograms() {
  const count = await db.exercises.count();
  if (count === 0) {
    await db.exercises.bulkPut(catalog as LibraryExercise[]);
    await createBuiltinPrograms();
  } else {
    await syncBuiltinExercises();
  }
  let settings = await db.settings.get("settings");
  if (!settings) {
    settings = { id: "settings", unit: "kg" };
    await db.settings.put(settings);
  }

  const programs = await db.programs.toArray();
  for (const program of programs) {
    if (program.name === "Min-Max" && program.builtin !== "minmax") {
      await db.programs.put({ ...program, builtin: "minmax" });
      program.builtin = "minmax";
    }
  }
  await removeUpperLowerBuiltins();

  const minmax = await replaceMinmaxWith4x(await keepOneMinmax(settings.activeProgramId));
  const stored = await db.programs.toArray();
  let activeId = settings.activeProgramId;
  if (!activeId || !stored.some((item) => item.id === activeId)) {
    activeId = stored.find((item) => item.id !== minmax?.id)?.id ?? minmax?.id ?? stored[0]?.id;
  }
  let ongoingId = settings.ongoingProgramId;
  const ongoingStillThere = Boolean(ongoingId && stored.some((item) => item.id === ongoingId));
  if (!ongoingStillThere) {
    ongoingId = undefined;
    const activeSession = (await db.sessions.toArray()).find(
      (session) => session.status === "active" && session.slotId,
    );
    const weeks = activeSession ? await db.weeks.toArray() : [];
    const week = activeSession
      ? weeks.find((item) => item.slots.some((slot) => slot.id === activeSession.slotId))
      : undefined;
    if (week && stored.some((item) => item.id === week.programId)) ongoingId = week.programId;
  }
  if (settings.activeProgramId !== activeId || settings.ongoingProgramId !== ongoingId) {
    settings = {
      id: "settings",
      unit: settings.unit,
      ...(activeId ? { activeProgramId: activeId } : {}),
      ...(ongoingId ? { ongoingProgramId: ongoingId } : {}),
    };
    await db.settings.put(settings);
  }

  if (!activeId) return;
  const active = await db.programs.get(activeId);
  if (!active) return;
  const weekCount = await db.weeks.where("programId").equals(active.id).count();
  if (weekCount === 0) await db.weeks.put(newWeek(active, 1));
}

async function createBuiltinPrograms() {
  const exercises = await db.exercises.toArray();
  const minmaxEnsured = ensureMinmaxExercises(exercises);
  const minmaxRows = [...minmaxEnsured.created, ...minmaxEnsured.updated];
  if (minmaxRows.length) await db.exercises.bulkPut(minmaxRows);
  const minmax = minmaxProgram(minmaxEnsured.byName);
  await db.programs.put(minmax);
  await db.weeks.put(newWeek(minmax, 1));

  const afterMinmax = await db.exercises.toArray();
  const upperEnsured = ensureEssentialsExercises(afterMinmax);
  const upperRows = [...upperEnsured.created, ...upperEnsured.updated];
  if (upperRows.length) await db.exercises.bulkPut(upperRows);
}

async function syncBuiltinExercises() {
  const exercises = await db.exercises.toArray();
  const minmaxEnsured = ensureMinmaxExercises(exercises);
  const minmaxRows = [...minmaxEnsured.created, ...minmaxEnsured.updated];
  if (minmaxRows.length) await db.exercises.bulkPut(minmaxRows);
  const afterMinmax = await db.exercises.toArray();
  const upperEnsured = ensureEssentialsExercises(afterMinmax);
  const upperRows = [...upperEnsured.created, ...upperEnsured.updated];
  if (upperRows.length) await db.exercises.bulkPut(upperRows);
}

function isUpperLower(program: Program) {
  return program.builtin === "upper-lower" || program.name === "Upper/Lower";
}

async function removeUpperLowerBuiltins() {
  const copies = (await db.programs.toArray()).filter(isUpperLower);
  if (copies.length === 0) return;
  const weeks = await db.weeks.toArray();
  const sessions = await db.sessions.toArray();
  for (const program of copies) {
    const rows = weeks.filter((week) => week.programId === program.id);
    const slotIds = new Set(rows.flatMap((week) => week.slots.map((slot) => slot.id)));
    const activeIds = sessions
      .filter(
        (session) =>
          session.status === "active" && session.slotId != null && slotIds.has(session.slotId),
      )
      .map((session) => session.id);
    if (activeIds.length) await db.sessions.bulkDelete(activeIds);
    if (rows.length) await db.weeks.bulkDelete(rows.map((week) => week.id));
    await db.programs.delete(program.id);
  }
}

async function replaceMinmaxWith4x(existing: Program | null) {
  if (!existing) return null;
  if (isMinmax4x(existing)) return existing;

  const exercises = await db.exercises.toArray();
  const ensured = ensureMinmaxExercises(exercises);
  const rows = [...ensured.created, ...ensured.updated];
  if (rows.length) await db.exercises.bulkPut(rows);

  const next: Program = { ...minmaxProgram(ensured.byName), id: existing.id, weekIndex: 1 };
  const weeks = await db.weeks.where("programId").equals(existing.id).toArray();
  const slotIds = new Set(weeks.flatMap((week) => week.slots.map((slot) => slot.id)));
  const activeIds = (await db.sessions.toArray())
    .filter(
      (session) =>
        session.status === "active" && session.slotId != null && slotIds.has(session.slotId),
    )
    .map((session) => session.id);
  if (activeIds.length) await db.sessions.bulkDelete(activeIds);
  if (weeks.length) await db.weeks.bulkDelete(weeks.map((week) => week.id));
  await db.programs.put(next);
  await db.weeks.put(newWeek(next, 1));
  return next;
}

async function keepOneMinmax(activeProgramId?: string) {
  const copies = (await db.programs.toArray()).filter(isMinmax);
  if (copies.length === 0) return null;
  if (copies.length === 1) return copies[0];

  const weeks = await db.weeks.toArray();
  const ranked = copies
    .map((program) => {
      const rows = weeks.filter((week) => week.programId === program.id);
      const done = rows.reduce(
        (total, week) => total + week.slots.filter((slot) => slot.status === "done").length,
        0,
      );
      const pass = rows.reduce((max, week) => Math.max(max, week.pass), 0);
      return { program, done, pass, rows };
    })
    .sort((a, b) => {
      if (b.done !== a.done) return b.done - a.done;
      if (b.pass !== a.pass) return b.pass - a.pass;
      const aActive = a.program.id === activeProgramId ? 1 : 0;
      const bActive = b.program.id === activeProgramId ? 1 : 0;
      return bActive - aActive;
    });

  const keep = ranked[0].program;
  for (const extra of ranked.slice(1)) {
    await db.programs.delete(extra.program.id);
    if (extra.rows.length) await db.weeks.bulkDelete(extra.rows.map((week) => week.id));
  }
  return keep;
}
