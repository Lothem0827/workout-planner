import Dexie, { type Table } from "dexie";
import catalog from "@/data/catalog.json";
import { newWeek } from "./logic";
import { ensureEssentialsExercises, essentialsProgram } from "./essentials";
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

  let minmax = await keepOneMinmax(settings.activeProgramId);
  if (!minmax) {
    const exercises = await db.exercises.toArray();
    const { created, updated, byName } = ensureMinmaxExercises(exercises);
    const rows = [...created, ...updated];
    if (rows.length) await db.exercises.bulkPut(rows);
    minmax = minmaxProgram(byName);
    await db.programs.put(minmax);
    await db.weeks.put(newWeek(minmax, 1));
    minmax = await keepOneMinmax(settings.activeProgramId);
  }

  const programsAfterMinmax = await db.programs.toArray();
  const hasUpper = programsAfterMinmax.some(
    (program) => program.builtin === "upper-lower" || program.name === "Upper/Lower",
  );
  if (!hasUpper) {
    const exercises = await db.exercises.toArray();
    const { created, byName } = ensureEssentialsExercises(exercises);
    if (created.length) await db.exercises.bulkPut(created);
    const upper = essentialsProgram(byName);
    await db.programs.put(upper);
    await db.weeks.put(newWeek(upper, 1));
  }

  const stored = await db.programs.toArray();
  let activeId = settings.activeProgramId;
  if (!activeId) {
    activeId = stored.find((item) => item.id !== minmax?.id)?.id ?? minmax?.id;
  } else if (!stored.some((item) => item.id === activeId)) {
    activeId = minmax?.id ?? stored[0]?.id;
  }
  if (activeId && settings.activeProgramId !== activeId) {
    settings = { ...settings, activeProgramId: activeId };
    await db.settings.put(settings);
  }

  const active = (activeId && (await db.programs.get(activeId))) || minmax;
  if (!active) return;
  const weekCount = await db.weeks.where("programId").equals(active.id).count();
  if (weekCount === 0) await db.weeks.put(newWeek(active, 1));
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
