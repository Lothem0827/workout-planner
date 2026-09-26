"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db, seedIfEmpty } from "./db";
import {
  applyPrs,
  byIdMap,
  exerciseTitle,
  newWeek,
  sessionFromSlot,
  uid,
} from "./logic";
import type {
  LibraryExercise,
  Pattern,
  Program,
  Session,
  Settings,
  WeekPlan,
} from "./types";

interface GymValue {
  ready: boolean;
  exercises: LibraryExercise[];
  programs: Program[];
  program: Program | null;
  week: WeekPlan | null;
  sessions: Session[];
  settings: Settings;
  map: Map<string, LibraryExercise>;
  saveProgram: (program: Program) => Promise<void>;
  selectProgram: (id: string) => Promise<void>;
  beginProgram: (id: string) => Promise<void>;
  saveWeek: (week: WeekPlan) => Promise<void>;
  saveSession: (session: Session) => Promise<void>;
  startSlot: (slotId: string) => Promise<string | null>;
  finishSession: (sessionId: string) => Promise<void>;
  setUnit: (unit: "kg" | "lb") => Promise<void>;
  addExercise: (input: {
    name: string;
    primary: LibraryExercise["primary"];
    equipment: string;
    pattern: Pattern;
  }) => Promise<LibraryExercise>;
  replaceInProgram: (dayId: string, fromId: string, toId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;
  restartWeek: (id: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const GymContext = createContext<GymValue | null>(null);

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadAll() {
  const [exercises, programs, weeks, sessions, settings] = await Promise.all([
    db.exercises.toArray(),
    db.programs.toArray(),
    db.weeks.toArray(),
    db.sessions.toArray(),
    db.settings.get("settings"),
  ]);
  const stored = settings ?? { id: "settings" as const, unit: "kg" as const };
  const program =
    programs.find((item) => item.id === stored.activeProgramId) ?? programs[0] ?? null;
  const week =
    weeks
      .filter((item) => item.programId === program?.id)
      .sort((a, b) => b.pass - a.pass)[0] ?? null;
  return {
    exercises,
    programs,
    program,
    week,
    sessions,
    settings: stored,
  };
}

export function GymProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [week, setWeek] = useState<WeekPlan | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>({ id: "settings", unit: "kg" });

  async function refresh() {
    const next = await loadAll();
    setExercises(
      next.exercises.map((exercise) => {
        const name = exerciseTitle(exercise.name);
        return name === exercise.name ? exercise : { ...exercise, name };
      }),
    );
    setPrograms(next.programs);
    setProgram(next.program);
    setWeek(next.week);
    setSessions(next.sessions);
    setSettings(next.settings);
  }

  useEffect(() => {
    seedIfEmpty()
      .then(refresh)
      .finally(() => setReady(true));
  }, []);

  const map = useMemo(() => byIdMap(exercises), [exercises]);

  const value: GymValue = {
    ready,
    exercises,
    programs,
    program,
    week,
    sessions,
    settings,
    map,
    async saveProgram(nextProgram) {
      await db.programs.put(nextProgram);
      const stored = await db.settings.get("settings");
      await db.settings.put({
        id: "settings",
        unit: stored?.unit ?? "kg",
        activeProgramId: nextProgram.id,
        ...(stored?.ongoingProgramId ? { ongoingProgramId: stored.ongoingProgramId } : {}),
      });
      const existing = await db.weeks.where("programId").equals(nextProgram.id).toArray();
      if (existing.length) await db.weeks.bulkDelete(existing.map((item) => item.id));
      await db.weeks.put(newWeek(nextProgram, 1));
      await refresh();
    },
    async selectProgram(id) {
      const chosen = await db.programs.get(id);
      if (!chosen) return;
      const stored = await db.settings.get("settings");
      await db.settings.put({
        id: "settings",
        unit: stored?.unit ?? "kg",
        activeProgramId: id,
        ...(stored?.ongoingProgramId ? { ongoingProgramId: stored.ongoingProgramId } : {}),
      });
      const existing = await db.weeks.where("programId").equals(id).count();
      if (existing === 0) await db.weeks.put(newWeek(chosen, 1));
      await refresh();
    },
    async beginProgram(id) {
      const chosen = await db.programs.get(id);
      if (!chosen) return;
      const stored = await db.settings.get("settings");
      await db.settings.put({
        id: "settings",
        unit: stored?.unit ?? "kg",
        activeProgramId: id,
        ongoingProgramId: id,
      });
      const existing = await db.weeks.where("programId").equals(id).count();
      if (existing === 0) await db.weeks.put(newWeek(chosen, 1));
      await refresh();
    },
    async saveWeek(nextWeek) {
      await db.weeks.put(nextWeek);
      await refresh();
    },
    async saveSession(session) {
      await enqueue(() => db.sessions.put(session));
      if (session.status === "finished") {
        const all = await db.sessions.toArray();
        applyPrs(all);
        await db.sessions.bulkPut(all);
      }
      await refresh();
    },
    async startSlot(slotId) {
      const current = await loadAll();
      const active = current.sessions.find(
        (session) => session.status === "active" && session.slotId === slotId,
      );
      const slot = current.week?.slots.find((item) => item.id === slotId);
      if (!active && (!slot || !current.week)) return null;
      const programId = current.program?.id;
      const markOngoing = Boolean(programId && current.settings.ongoingProgramId !== programId);
      if (markOngoing && programId) {
        await db.settings.put({
          id: "settings",
          unit: current.settings.unit ?? "kg",
          ...(current.settings.activeProgramId ? { activeProgramId: current.settings.activeProgramId } : {}),
          ongoingProgramId: programId,
        });
      }
      if (active) {
        if (markOngoing) await refresh();
        return active.id;
      }
      if (!slot || !current.week) return null;
      const session = sessionFromSlot(
        slot,
        current.sessions,
        byIdMap(current.exercises),
        current.program?.weekIndex,
      );
      slot.sessionId = session.id;
      await db.sessions.put(session);
      await db.weeks.put(current.week);
      await refresh();
      return session.id;
    },
    async finishSession(sessionId) {
      const current = await loadAll();
      const session = current.sessions.find((item) => item.id === sessionId);
      if (!session) return;
      session.status = "finished";
      session.finishedAt = Date.now();
      const storedWeeks = await db.weeks.toArray();
      const week = storedWeeks.find((item) =>
        item.slots.some((slot) => slot.id === session.slotId),
      );
      const program = current.programs.find((item) => item.id === week?.programId);
      if (week) {
        const slot = week.slots.find((item) => item.id === session.slotId);
        if (slot) slot.status = "done";
      }
      const nextSessions = current.sessions.map((item) =>
        item.id === session.id ? session : item,
      );
      applyPrs(nextSessions);
      await db.sessions.bulkPut(nextSessions);
      if (!week || !program) {
        await refresh();
        return;
      }
      const pending = week.slots.some((item) => item.status === "pending");
      await db.weeks.put(week);
      if (!pending) {
        const weeks = program.weeks;
        const index = program.weekIndex ?? 0;
        if (weeks?.length && index >= weeks.length) {
          await refresh();
          return;
        }
        const nextProgram =
          weeks?.length && index > 0
            ? {
                ...program,
                weekIndex: index + 1,
                days: weeks.find((item) => item.week === index + 1)?.days ?? program.days,
              }
            : program;
        if (nextProgram !== program) await db.programs.put(nextProgram);
        await db.weeks.put(newWeek(nextProgram, week.pass + 1));
      }
      await refresh();
    },
    async setUnit(unit) {
      const stored = await db.settings.get("settings");
      const next: Settings = {
        id: "settings",
        unit,
        ...(stored?.activeProgramId ? { activeProgramId: stored.activeProgramId } : {}),
        ...(stored?.ongoingProgramId ? { ongoingProgramId: stored.ongoingProgramId } : {}),
      };
      await db.settings.put(next);
      setSettings(next);
    },
    async addExercise(input) {
      const exercise: LibraryExercise = {
        id: `custom-${uid()}`,
        name: input.name.trim(),
        primary: input.primary,
        secondary: [],
        equipment: input.equipment.trim() || "other",
        pattern: input.pattern,
        custom: true,
      };
      await db.exercises.put(exercise);
      await refresh();
      return exercise;
    },
    async replaceInProgram(dayId, fromId, toId) {
      if (!program) return;
      const next: Program = {
        ...program,
        days: program.days.map((day) =>
          day.id !== dayId
            ? day
            : {
                ...day,
                exercises: day.exercises.map((exercise) =>
                  exercise.exerciseId === fromId
                    ? { ...exercise, exerciseId: toId }
                    : exercise,
                ),
              },
        ),
      };
      const withWeeks: Program = next.weeks
        ? {
            ...next,
            weeks: next.weeks.map((item) =>
              item.week !== next.weekIndex
                ? item
                : {
                    ...item,
                    days: item.days.map((day) =>
                      day.id !== dayId
                        ? day
                        : {
                            ...day,
                            exercises: day.exercises.map((exercise) =>
                              exercise.exerciseId === fromId
                                ? { ...exercise, exerciseId: toId }
                                : exercise,
                            ),
                          },
                    ),
                  },
            ),
          }
        : next;
      await db.programs.put(withWeeks);
      if (week) {
        const updated: WeekPlan = {
          ...week,
          slots: week.slots.map((slot) =>
            slot.sourceDayId !== dayId || slot.status !== "pending"
              ? slot
              : {
                  ...slot,
                  exercises: slot.exercises.map((exercise) =>
                    exercise.exerciseId === fromId
                      ? { ...exercise, exerciseId: toId }
                      : exercise,
                  ),
                },
          ),
        };
        await db.weeks.put(updated);
      }
      await refresh();
    },
    async deleteSession(sessionId) {
      const current = await loadAll();
      await db.sessions.delete(sessionId);
      const storedWeeks = await db.weeks.toArray();
      for (const week of storedWeeks) {
        if (!week.slots.some((slot) => slot.sessionId === sessionId)) continue;
        const weekNext: WeekPlan = {
          ...week,
          slots: week.slots.map((slot) =>
            slot.sessionId === sessionId
              ? { ...slot, status: "pending", sessionId: undefined }
              : slot,
          ),
        };
        await db.weeks.put(weekNext);
      }
      const remaining = current.sessions.filter((session) => session.id !== sessionId);
      applyPrs(remaining);
      await db.sessions.bulkPut(remaining);
      await refresh();
    },
    async deleteProgram(id) {
      await enqueue(async () => {
        const weeks = await db.weeks.where("programId").equals(id).toArray();
        const slotIds = new Set(weeks.flatMap((week) => week.slots.map((slot) => slot.id)));
        if (slotIds.size > 0) {
          const activeIds = (await db.sessions.toArray())
            .filter(
              (session) =>
                session.status === "active" && session.slotId != null && slotIds.has(session.slotId),
            )
            .map((session) => session.id);
          if (activeIds.length) await db.sessions.bulkDelete(activeIds);
        }
        if (weeks.length) await db.weeks.bulkDelete(weeks.map((week) => week.id));
        await db.programs.delete(id);

        const remaining = await db.programs.toArray();
        const stored = await db.settings.get("settings");
        const stillActive = remaining.some((item) => item.id === stored?.activeProgramId);
        const nextActive = stillActive ? stored?.activeProgramId : remaining[0]?.id;
        const ongoing =
          stored?.ongoingProgramId && stored.ongoingProgramId !== id ? stored.ongoingProgramId : undefined;
        await db.settings.put({
          id: "settings",
          unit: stored?.unit ?? "kg",
          ...(nextActive ? { activeProgramId: nextActive } : {}),
          ...(ongoing ? { ongoingProgramId: ongoing } : {}),
        });
        if (nextActive) {
          const chosen = remaining.find((item) => item.id === nextActive);
          const weekCount = await db.weeks.where("programId").equals(nextActive).count();
          if (chosen && weekCount === 0) await db.weeks.put(newWeek(chosen, 1));
        }
      });
      await refresh();
    },
    async restartWeek(id) {
      await enqueue(async () => {
        const chosen = await db.programs.get(id);
        if (!chosen) return;
        const storedWeeks = await db.weeks.where("programId").equals(id).toArray();
        const latest = [...storedWeeks].sort((a, b) => b.pass - a.pass)[0] ?? null;
        const weekCount = chosen.weeks?.length ?? 0;
        const index = chosen.weekIndex ?? 1;
        const finished =
          weekCount > 0 &&
          index >= weekCount &&
          latest != null &&
          !latest.slots.some((slot) => slot.status === "pending");
        const firstWeek = [...(chosen.weeks ?? [])].sort((a, b) => a.week - b.week)[0];
        const nextProgram =
          finished && firstWeek
            ? { ...chosen, weekIndex: firstWeek.week, days: firstWeek.days }
            : chosen;
        if (nextProgram !== chosen) await db.programs.put(nextProgram);

        if (latest) {
          const slotIds = new Set(latest.slots.map((slot) => slot.id));
          const sessions = await db.sessions.toArray();
          const activeIds = sessions
            .filter(
              (session) =>
                session.status === "active" &&
                session.slotId != null &&
                slotIds.has(session.slotId),
            )
            .map((session) => session.id);
          if (activeIds.length) {
            await db.sessions.bulkDelete(activeIds);
            const remaining = sessions.filter((session) => !activeIds.includes(session.id));
            applyPrs(remaining);
            await db.sessions.bulkPut(remaining);
          }
          await db.weeks.delete(latest.id);
        }

        const pass = finished ? (latest?.pass ?? 0) + 1 : (latest?.pass ?? 1);
        await db.weeks.put(newWeek(nextProgram, pass));
        const stored = await db.settings.get("settings");
        await db.settings.put({
          id: "settings",
          unit: stored?.unit ?? "kg",
          activeProgramId: id,
          ...(stored?.ongoingProgramId ? { ongoingProgramId: stored.ongoingProgramId } : {}),
        });
      });
      await refresh();
    },
    async clearAllData() {
      await enqueue(async () => {
        await db.transaction(
          "rw",
          [db.sessions, db.weeks, db.programs, db.exercises, db.settings],
          async () => {
            await db.sessions.clear();
            await db.weeks.clear();
            await db.programs.clear();
            await db.exercises.clear();
            await db.settings.clear();
          },
        );
        await seedIfEmpty();
      });
      await refresh();
    },
  };

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGym() {
  const value = useContext(GymContext);
  if (!value) throw new Error("useGym outside provider");
  return value;
}
