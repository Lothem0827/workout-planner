"use client";

import { useEffect, useRef, useState } from "react";
import { GripVerticalIcon, MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { useRouter, useSearchParams } from "next/navigation";
import { StackHeader } from "@/components/stack-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGym } from "@/lib/gym";
import { uid } from "@/lib/logic";
import { blankProgram, TEMPLATE_OPTIONS, templateProgram } from "@/lib/templates";
import { MUSCLE_LABEL, MUSCLES, PATTERN_LABEL, PATTERNS, type LibraryExercise, type PlannedExercise, type Program, type ProgramDay } from "@/lib/types";

const MUSCLE_ITEMS = [
  { label: "All muscles", value: "all" },
  ...MUSCLES.map((item) => ({ label: MUSCLE_LABEL[item], value: item })),
];

const PRIMARY_ITEMS = MUSCLES.map((item) => ({ label: MUSCLE_LABEL[item], value: item }));
const PATTERN_ITEMS = PATTERNS.map((item) => ({ label: PATTERN_LABEL[item], value: item }));

export function ProgramEditor() {
  const gym = useGym();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const [program, setProgram] = useState<Program>(() => blankProgram(3));
  const [editingWeek, setEditingWeek] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState({
    name: "",
    primary: MUSCLES[0],
    equipment: "",
    pattern: PATTERNS[0],
  });

  useEffect(() => {
    if (!gym.ready || hydrated) return;
    if (!isNew && gym.program) {
      setProgram(gym.program);
      setEditingWeek(gym.program.weekIndex ?? 1);
    }
    setHydrated(true);
  }, [gym.ready, gym.program, hydrated, isNew]);

  if (!gym.ready || !hydrated) {
    return (
      <main>
        <StackHeader title="Program" fallback="/train" />
        <div className="flex flex-col gap-4 px-4 py-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  const weekCount = program.weeks?.length ?? 1;
  const visibleDays =
    program.weeks?.find((week) => week.week === editingWeek)?.days ?? program.days;

  const results = gym.exercises
    .filter((exercise) => muscle === "all" || exercise.primary === muscle)
    .filter((exercise) => exercise.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  function applyTemplate(kind: string) {
    const next = templateProgram(kind, gym.exercises);
    if (!next) return;
    setProgram((current) => {
      const saved: Program = { ...current, days: next.days };
      delete saved.weeks;
      delete saved.weekIndex;
      return saved;
    });
    setEditingWeek(1);
  }

  function setDayCount(count: number) {
    setProgram((current) => resizeDays(current, count));
  }

  function changeWeekCount(count: number) {
    setProgram((current) => resizeWeekCount(current, count, editingWeek));
    setEditingWeek((open) => Math.min(open, count));
  }

  function patchVisible(recipe: (days: ProgramDay[]) => ProgramDay[]) {
    setProgram((current) => {
      const weeks = current.weeks;
      if (!weeks || weeks.length <= 1) return { ...current, days: recipe(current.days) };
      const open = weeks.find((week) => week.week === editingWeek) ?? weeks[0];
      const nextDays = recipe(open.days);
      const training = current.weekIndex ?? 1;
      return {
        ...current,
        days: editingWeek === training ? nextDays : current.days,
        weeks: weeks.map((week) => (week.week === open.week ? { ...week, days: nextDays } : week)),
      };
    });
  }

  return (
    <main>
      <StackHeader title="Program" fallback="/train" />
      <div className="flex flex-col gap-4 px-4 py-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="program-name">Name</FieldLabel>
          <Input
            id="program-name"
            value={program.name}
            onChange={(event) => setProgram({ ...program, name: event.target.value })}
          />
        </Field>
      </FieldGroup>
      <Card>
        <CardHeader>
          <CardTitle>Days</CardTitle>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Fewer days" onClick={() => setDayCount(Math.max(2, visibleDays.length - 1))}>
              <MinusIcon />
            </Button>
            <span className="tabular-nums">{visibleDays.length}</span>
            <Button type="button" variant="outline" size="icon" aria-label="More days" onClick={() => setDayCount(Math.min(6, visibleDays.length + 1))}>
              <PlusIcon />
            </Button>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Weeks</CardTitle>
          <CardDescription>{weekCount === 1 ? "Repeats" : "Different each week"}</CardDescription>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Fewer weeks" onClick={() => changeWeekCount(Math.max(1, weekCount - 1))}>
              <MinusIcon />
            </Button>
            <span className="tabular-nums">{weekCount}</span>
            <Button type="button" variant="outline" size="icon" aria-label="More weeks" onClick={() => changeWeekCount(Math.min(12, weekCount + 1))}>
              <PlusIcon />
            </Button>
          </div>
        </CardHeader>
      </Card>
      {weekCount > 1 ? (
        <ScrollArea className="w-full">
          <ToggleGroup
            className="w-max"
            value={[String(editingWeek)]}
            onValueChange={(value) => {
              const next = Number(value[0]);
              if (next) setEditingWeek(next);
            }}
          >
            {program.weeks?.map((week) => (
              <ToggleGroupItem key={week.week} value={String(week.week)}>
                Week {week.week}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ScrollArea>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_OPTIONS.map((option) => (
          <Button key={option.id} type="button" variant="outline" size="sm" onClick={() => applyTemplate(option.id)}>
            {option.label}
          </Button>
        ))}
      </div>
      {visibleDays.map((day, dayIndex) => (
        <Card key={day.id}>
          <CardHeader>
            <Field>
              <FieldLabel htmlFor={`day-${day.id}`}>Day name</FieldLabel>
              <Input
                id={`day-${day.id}`}
                value={day.name}
                onChange={(event) => {
                  const name = event.target.value;
                  patchVisible((days) => days.map((item) => (item.id === day.id ? { ...item, name } : item)));
                }}
              />
            </Field>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ExerciseList
              exercises={day.exercises}
              nameFor={(exerciseId) => gym.map.get(exerciseId)?.name ?? "Exercise"}
              onUpdate={(exerciseId, patch) => updateExercise(day.id, exerciseId, patch)}
              onReorder={(from, to) => reorderExercises(day.id, from, to)}
            />
            <Button type="button" variant="link" className="self-start" onClick={() => setPickerDay(day.id)}>
              Add exercise
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => moveDay(dayIndex, -1)}>Move day up</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => moveDay(dayIndex, 1)}>Move day down</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        className="w-full"
        onClick={async () => {
          await gym.saveProgram(toSavedProgram(program));
          router.push("/train");
        }}
      >
        Save program
      </Button>
      </div>

      <Drawer open={pickerDay != null} onOpenChange={(open) => { if (!open) setPickerDay(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add exercise</DrawerTitle>
            <DrawerDescription>Search the library or add your own.</DrawerDescription>
          </DrawerHeader>
          <div className="flex max-h-[70dvh] flex-col gap-3 overflow-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="exercise-search">Search</FieldLabel>
                <Input id="exercise-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
              </Field>
              <Field>
                <FieldLabel htmlFor="exercise-muscle">Muscle</FieldLabel>
                <Select
                  items={MUSCLE_ITEMS}
                  value={muscle}
                  onValueChange={(value) => { if (value) setMuscle(value); }}
                >
                  <SelectTrigger id="exercise-muscle" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MUSCLE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <ul className="flex flex-col gap-2">
              {results.map((exercise) => (
                <li key={exercise.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full flex-col items-start"
                    onClick={() => {
                      patchVisible((days) =>
                        days.map((day) =>
                          day.id !== pickerDay
                            ? day
                            : {
                                ...day,
                                exercises: [
                                  ...day.exercises,
                                  { id: uid(), exerciseId: exercise.id, sets: 3, repMin: 6, repMax: 10 },
                                ],
                              },
                        ),
                      );
                      setPickerDay(null);
                    }}
                  >
                    <span>{exercise.name}</span>
                    <span className="text-muted-foreground">{MUSCLE_LABEL[exercise.primary]} · {exercise.equipment}</span>
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="link" className="self-start" onClick={() => setAdding(true)}>
              Add your own exercise
            </Button>
            {adding ? (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const created = await gym.addExercise(custom);
                  patchVisible((days) =>
                    days.map((day) =>
                      day.id !== pickerDay
                        ? day
                        : {
                            ...day,
                            exercises: [
                              ...day.exercises,
                              { id: uid(), exerciseId: created.id, sets: 3, repMin: 6, repMax: 10 },
                            ],
                          },
                    ),
                  );
                  setAdding(false);
                  setPickerDay(null);
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="custom-name">Name</FieldLabel>
                    <Input required id="custom-name" placeholder="Name" value={custom.name} onChange={(event) => setCustom({ ...custom, name: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="custom-primary">Muscle</FieldLabel>
                    <Select
                      items={PRIMARY_ITEMS}
                      value={custom.primary}
                      onValueChange={(value) => {
                        if (value) setCustom({ ...custom, primary: value as LibraryExercise["primary"] });
                      }}
                    >
                      <SelectTrigger id="custom-primary" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PRIMARY_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="custom-equipment">Equipment</FieldLabel>
                    <Input required id="custom-equipment" placeholder="Equipment" value={custom.equipment} onChange={(event) => setCustom({ ...custom, equipment: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="custom-pattern">Pattern</FieldLabel>
                    <Select
                      items={PATTERN_ITEMS}
                      value={custom.pattern}
                      onValueChange={(value) => {
                        if (value) setCustom({ ...custom, pattern: value as LibraryExercise["pattern"] });
                      }}
                    >
                      <SelectTrigger id="custom-pattern" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PATTERN_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button type="submit" className="w-full">Save exercise</Button>
                </FieldGroup>
              </form>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );

  function updateExercise(dayId: string, exerciseId: string, patch: ExercisePatch) {
    patchVisible((days) =>
      days.map((day) =>
        day.id !== dayId
          ? day
          : {
              ...day,
              exercises: day.exercises.map((exercise) =>
                exercise.id === exerciseId ? mergeExercise(exercise, patch) : exercise,
              ),
            },
      ),
    );
  }

  function reorderExercises(dayId: string, from: number, to: number) {
    patchVisible((days) =>
      days.map((day) => {
        if (day.id !== dayId) return day;
        if (from === to || from < 0 || to < 0 || from >= day.exercises.length || to >= day.exercises.length) return day;
        const next = [...day.exercises];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return { ...day, exercises: next };
      }),
    );
  }

  function moveDay(index: number, delta: number) {
    patchVisible((days) => {
      const target = index + delta;
      if (target < 0 || target >= days.length) return days;
      const next = [...days];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }
}

type ExercisePatch = Partial<
  Pick<PlannedExercise, "sets" | "repMin" | "repMax" | "technique" | "warmupSets" | "rest" | "notes">
>;

const PRESCRIPTION_KEYS = ["technique", "warmupSets", "rest", "notes"] as const;

function textOrUndefined(value: string) {
  return value.trim() ? value : undefined;
}

function mergeExercise(exercise: PlannedExercise, patch: ExercisePatch): PlannedExercise {
  const next = { ...exercise, ...patch };
  for (const key of PRESCRIPTION_KEYS) {
    if (next[key] === undefined) delete next[key];
  }
  return next;
}

function ExerciseList({
  exercises,
  nameFor,
  onUpdate,
  onReorder,
}: {
  exercises: PlannedExercise[];
  nameFor: (exerciseId: string) => string;
  onUpdate: (exerciseId: string, patch: ExercisePatch) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const count = useRef(exercises.length);
  const stopDrag = useRef<(() => void) | null>(null);
  count.current = exercises.length;
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  useEffect(() => {
    return () => stopDrag.current?.();
  }, []);

  useEffect(() => {
    if (dragging == null) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [dragging]);

  function rowAt(clientY: number) {
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count.current; index += 1) {
      const node = itemRefs.current[index];
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return index;
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    }
    return nearest;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>, index: number) {
    if (event.button !== 0) return;
    const pointerId = event.pointerId;
    const startY = event.clientY;
    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // The pointer can already be inactive in synthetic drags.
    }

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (Math.abs(ev.clientY - startY) < 6) return;
      setDragging(index);
      setOver(rowAt(ev.clientY));
    };
    const clear = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      stopDrag.current = null;
      setDragging(null);
      setOver(null);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const to = Math.abs(ev.clientY - startY) >= 6 ? rowAt(ev.clientY) : index;
      clear();
      if (to !== index) onReorder(index, to);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      clear();
    };
    stopDrag.current?.();
    stopDrag.current = clear;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((exercise, index) => {
        const name = nameFor(exercise.exerciseId);
        return (
          <li
            key={exercise.id}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className={cn(
              "flex flex-col gap-2 rounded-lg text-sm transition-colors",
              dragging === index && "opacity-40",
              dragging != null && over === index && dragging !== index && "bg-muted",
            )}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={`Reorder ${name}`}
              className="flex min-w-0 cursor-grab touch-none items-center gap-2 rounded-md select-none active:cursor-grabbing"
              onPointerDown={(event) => onPointerDown(event, index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  onReorder(index, index - 1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  onReorder(index, index + 1);
                }
              }}
            >
              <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">{name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 tabular-nums">
              <label className="flex items-center gap-1.5 text-muted-foreground">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={exercise.sets}
                  onChange={(event) => onUpdate(exercise.id, { sets: Number(event.target.value) })}
                  className="w-14 text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                sets
              </label>
              <span className="text-muted-foreground" aria-hidden="true">×</span>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={exercise.repMin}
                  onChange={(event) => onUpdate(exercise.id, { repMin: Number(event.target.value) })}
                  className="w-14 text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Minimum reps"
                />
                <span aria-hidden="true">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={exercise.repMax}
                  onChange={(event) => onUpdate(exercise.id, { repMax: Number(event.target.value) })}
                  className="w-14 text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Maximum reps"
                />
                reps
              </div>
            </div>
            <div className="flex flex-col gap-2 pl-6">
              <label className="flex flex-col gap-1 text-muted-foreground">
                <span>Last-set intensity</span>
                <Input
                  value={exercise.technique ?? ""}
                  placeholder="Drop set"
                  onChange={(event) =>
                    onUpdate(exercise.id, { technique: textOrUndefined(event.target.value) })
                  }
                  className="text-foreground"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-muted-foreground">
                  <span>Warm-up sets</span>
                  <Input
                    value={exercise.warmupSets ?? ""}
                    placeholder="2-4"
                    onChange={(event) =>
                      onUpdate(exercise.id, { warmupSets: textOrUndefined(event.target.value) })
                    }
                    className="text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-muted-foreground">
                  <span>Rest</span>
                  <Input
                    value={exercise.rest ?? ""}
                    placeholder="3-5 min"
                    onChange={(event) =>
                      onUpdate(exercise.id, { rest: textOrUndefined(event.target.value) })
                    }
                    className="text-foreground"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-muted-foreground">
                <span>Notes</span>
                <textarea
                  rows={2}
                  value={exercise.notes ?? ""}
                  onChange={(event) =>
                    onUpdate(exercise.id, { notes: textOrUndefined(event.target.value) })
                  }
                  className="min-h-16 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                />
              </label>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function copyDays(days: ProgramDay[]): ProgramDay[] {
  return days.map((day) => ({
    ...day,
    id: uid(),
    exercises: day.exercises.map((exercise) => ({ ...exercise, id: uid() })),
  }));
}

function fitDayCount(days: ProgramDay[], count: number) {
  const next = days.slice(0, count);
  while (next.length < count) {
    next.push({ id: uid(), name: `Day ${next.length + 1}`, exercises: [] });
  }
  return next;
}

function resizeDays(program: Program, count: number): Program {
  if (!program.weeks || program.weeks.length <= 1) {
    return { ...program, days: fitDayCount(program.days, count) };
  }
  const weeks = program.weeks.map((week) => ({ ...week, days: fitDayCount(week.days, count) }));
  const training = program.weekIndex ?? 1;
  return {
    ...program,
    weeks,
    days: weeks.find((week) => week.week === training)?.days ?? weeks[0].days,
  };
}

function resizeWeekCount(program: Program, count: number, openWeek: number): Program {
  if (count <= 1) {
    const days = program.weeks?.find((week) => week.week === openWeek)?.days ?? program.days;
    const next: Program = { ...program, days };
    delete next.weeks;
    delete next.weekIndex;
    return next;
  }
  let weeks = program.weeks?.length
    ? program.weeks.map((week) => ({ ...week }))
    : [{ week: 1, days: program.days }];
  while (weeks.length < count) {
    weeks.push({ week: weeks.length + 1, days: copyDays(weeks[weeks.length - 1].days) });
  }
  if (weeks.length > count) weeks = weeks.slice(0, count);
  weeks = weeks.map((week, index) => ({ ...week, week: index + 1 }));
  const training = Math.min(program.weekIndex ?? 1, weeks.length);
  return {
    ...program,
    weekIndex: training,
    weeks,
    days: weeks.find((week) => week.week === training)?.days ?? weeks[0].days,
  };
}

function toSavedProgram(program: Program): Program {
  const weeks = program.weeks;
  if (!weeks || weeks.length <= 1) {
    const next: Program = { ...program, days: weeks?.[0]?.days ?? program.days };
    delete next.weeks;
    delete next.weekIndex;
    return next;
  }
  const training = Math.min(Math.max(program.weekIndex ?? 1, 1), weeks.length);
  const days = weeks.find((week) => week.week === training)?.days ?? weeks[0].days;
  return { ...program, weekIndex: training, days, weeks };
}
