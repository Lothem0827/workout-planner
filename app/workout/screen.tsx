"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type UIEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StackHeader } from "@/components/stack-header";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { useGym } from "@/lib/gym";
import { PlanScreen } from "./plan-screen";
import { ExerciseSlide, SubstitutionSheet, substitutionChoices } from "./exercise-slide";
import { RestOverlay } from "./rest-overlay";
import { WorkoutSummary } from "./summary";
import {
  activeSessionForWeek,
  doneSetCount,
  restMs,
  suggestedWeightKg,
  swapRank,
  volumeKg,
} from "@/lib/logic";
import { formatLoad } from "@/lib/units";
import {
  MUSCLE_LABEL,
  MUSCLES,
  PATTERN_LABEL,
  PATTERNS,
  type LibraryExercise,
  type Session,
  type SessionExercise,
} from "@/lib/types";

export function WorkoutScreen() {
  const params = useSearchParams();
  const planId = params.get("plan");
  const sessionId = params.get("session");
  if (planId && !sessionId) return <PlanScreen planId={planId} />;
  return <SessionScreen />;
}

function exerciseDone(exercise: SessionExercise) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.done);
}

function restCaptionFor(
  session: Session,
  index: number,
  map: Map<string, { name: string }>,
) {
  const exercise = session.exercises[index];
  if (!exercise) return "Rest";
  const name = map.get(exercise.exerciseId)?.name ?? "Exercise";
  const done = exercise.sets.filter((set) => set.done).length;
  if (done < exercise.sets.length) return `${name} · Set ${done + 1} of ${exercise.sets.length}`;
  const next = session.exercises[index + 1];
  if (!next) return name;
  return map.get(next.exerciseId)?.name ?? "Next exercise";
}

function SessionScreen() {
  const gym = useGym();
  const router = useRouter();
  const sessionId = useSearchParams().get("session");
  const requested = sessionId
    ? gym.sessions.find((session) => session.id === sessionId && session.status === "active")
    : null;
  const active = requested ?? activeSessionForWeek(gym.week, gym.sessions);
  const [now, setNow] = useState(Date.now());
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [subsId, setSubsId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [otherEquipment, setOtherEquipment] = useState(true);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const finishingRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const pendingWrites = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const swipeRef = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((value) => {
        lock = value;
      })
      .catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, []);

  if (!gym.ready) {
    return (
      <main className="min-h-dvh bg-background">
        <StackHeader title="Workout" fallback="/" />
        <div className="flex flex-col gap-4 px-4 py-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }
  if (summaryId) {
    const finished = gym.sessions.find((session) => session.id === summaryId);
    if (!finished || finished.status !== "finished") {
      return (
        <main className="min-h-dvh bg-background">
          <StackHeader title="Workout" fallback="/" />
          <div className="flex flex-col gap-4 px-4 py-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </main>
      );
    }
    return (
      <WorkoutSummary
        session={finished}
        map={gym.map}
        unit={gym.settings.unit}
        onDone={() => router.push("/")}
      />
    );
  }
  if (!active) {
    return (
      <main className="min-h-dvh bg-background">
        <StackHeader title="Workout" fallback="/" />
        <div className="px-4 py-4">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No workout in progress</EmptyTitle>
              <EmptyDescription>Start a day from Home or Workouts.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    );
  }

  const session = active;
  if (pendingWrites.current === 0) sessionRef.current = session;
  const seconds = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const clock = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const restLeft = restUntil
    ? Math.max(0, Math.ceil((restUntil - now) / 1000))
    : 0;

  function update(next: Session) {
    sessionRef.current = next;
    pendingWrites.current += 1;
    return gym.saveSession(next).finally(() => {
      pendingWrites.current -= 1;
    });
  }

  function patchExercise(
    exerciseId: string,
    patch: (exercise: SessionExercise) => SessionExercise,
  ) {
    const current = sessionRef.current ?? session;
    return {
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId ? patch(exercise) : exercise,
      ),
    };
  }

  const priorSessions = gym.sessions.filter((item) => item.id !== session.id);
  const segments = session.exercises.map((exercise) => ({
    id: exercise.id,
    done: exerciseDone(exercise),
  }));
  const safeIndex = Math.min(index, Math.max(0, session.exercises.length - 1));
  indexRef.current = safeIndex;
  const current = session.exercises[safeIndex];
  const currentDone = current ? exerciseDone(current) : true;
  const isLast = safeIndex >= session.exercises.length - 1;
  const restCaption = restCaptionFor(session, safeIndex, gym.map);
  const subsExercise = subsId
    ? session.exercises.find((item) => item.id === subsId) ?? null
    : null;
  const subsChoices = subsExercise
    ? substitutionChoices(subsExercise, gym.exercises, gym.map)
    : [];
  const subsName = subsExercise
    ? gym.map.get(subsExercise.exerciseId)?.name ?? "Exercise"
    : "";

  function goTo(next: number) {
    const el = scrollerRef.current;
    const last = Math.max(0, session.exercises.length - 1);
    const clamped = Math.max(0, Math.min(last, next));
    indexRef.current = clamped;
    setIndex(clamped);
    if (!el?.clientWidth) return;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  function onSwipeStart(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input, textarea, button, a, iframe, select")) return;
    swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  }

  function onSwipeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (swipe.axis) return;
    if (Math.hypot(dx, dy) < 12) return;
    swipe.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (swipe.axis === "x") event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onSwipeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== event.pointerId) return;
    swipeRef.current = null;
    if (swipe.axis !== "x") return;
    const dx = event.clientX - swipe.x;
    if (dx <= -48) goTo(indexRef.current + 1);
    else if (dx >= 48) goTo(indexRef.current - 1);
  }

  function onPagerScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (!el.clientWidth || !session.exercises.length) return;
    const last = session.exercises.length - 1;
    const next = Math.max(0, Math.min(last, Math.round(el.scrollLeft / el.clientWidth)));
    setIndex((value) => (value === next ? value : next));
  }

  function openAlternatives(exercise: SessionExercise) {
    const choices = substitutionChoices(exercise, gym.exercises, gym.map);
    if (choices.length) {
      setSubsId(exercise.id);
      return;
    }
    setSwapId(exercise.id);
    setOtherEquipment(true);
    setQuery("");
  }

  function startRest(durationMs: number) {
    if (session.skipRest || durationMs <= 0) return;
    setRestUntil(Date.now() + durationMs);
  }

  function logOrNext() {
    if (!current) return;
    const open = current.sets.find((set) => !set.done);
    if (open) {
      void update(
        patchExercise(current.id, (item) => ({
          ...item,
          sets: item.sets.map((row) => (row.id === open.id ? { ...row, done: true } : row)),
        })),
      );
      startRest(open.restMs ?? restMs(current.rest));
      return;
    }
    if (!isLast) goTo(safeIndex + 1);
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setRestUntil(null);
    setSummaryId(session.id);
    try {
      await gym.finishSession(session.id);
    } catch {
      finishingRef.current = false;
      setSummaryId(null);
    }
  }

  const readyToFinish = Boolean(current && currentDone && isLast);

  return (
    <>
    <main
      inert={restLeft > 0 ? true : undefined}
      className="-mb-[env(safe-area-inset-bottom)] flex h-dvh flex-col overflow-hidden bg-background"
    >
      <StackHeader
        title={
          <>
            {session.name}
            {session.weekIndex ? (
              <span className="text-sm font-normal text-muted-foreground"> · Week {session.weekIndex}</span>
            ) : null}
          </>
        }
        fallback="/"
        detail={`${clock} · ${formatLoad(volumeKg(session), gym.settings.unit)} · ${doneSetCount(session)} sets`}
      >
        <Button
          type="button"
          variant={isLast ? "default" : "secondary"}
          className="mr-2 shrink-0"
          onClick={() => {
            void finish();
          }}
        >
          Finish
        </Button>
      </StackHeader>
      <div
        ref={scrollerRef}
        className="grid h-full min-h-0 flex-1 grid-flow-col auto-cols-[100%] grid-rows-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-none"
        onScroll={onPagerScroll}
        onPointerDown={onSwipeStart}
        onPointerMove={onSwipeMove}
        onPointerUp={onSwipeEnd}
        onPointerCancel={onSwipeEnd}
      >
        {session.exercises.map((exercise) => (
          <ExerciseSlide
            key={exercise.id}
            exercise={exercise}
            sessions={priorSessions}
            catalog={gym.exercises}
            map={gym.map}
            unit={gym.settings.unit}
            builtin={gym.program?.builtin}
            segments={segments}
            activeIndex={safeIndex}
            onJump={goTo}
            onOpenAlternatives={() => openAlternatives(exercise)}
            onPatch={(patch) => {
              void update(patchExercise(exercise.id, patch));
            }}
            onLoggedSet={(durationMs) => startRest(durationMs)}
            skipRest={Boolean(session.skipRest)}
            onSkipRest={(skip) => {
              const current = sessionRef.current ?? session;
              void update({ ...current, skipRest: skip || undefined });
            }}
          />
        ))}
      </div>
      <div className="shrink-0 bg-background px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          className="h-12 w-full text-base"
          disabled={!current}
          onClick={() => {
            if (readyToFinish) {
              void finish();
              return;
            }
            logOrNext();
          }}
        >
          {readyToFinish ? "Finish" : currentDone && !isLast ? "Next" : "Log Set"}
        </Button>
      </div>
      {subsExercise && subsChoices.length ? (
        <SubstitutionSheet
          name={subsName}
          choices={subsChoices}
          onClose={() => setSubsId(null)}
          onPick={(lib) => {
            void applySwap(subsExercise.id, lib, false);
          }}
        />
      ) : null}
      {swapId ? (
        <SwapSheet
          exercise={session.exercises.find((item) => item.id === swapId)!}
          catalog={gym.exercises}
          otherEquipment={otherEquipment}
          query={query}
          adding={adding}
          onQuery={setQuery}
          onOther={() => setOtherEquipment((value) => !value)}
          onClose={() => setSwapId(null)}
          onAddToggle={() => setAdding((value) => !value)}
          onCreate={async (input) => {
            const created = await gym.addExercise(input);
            if (swapId) await applySwap(swapId, created, false);
          }}
          onPick={(lib, permanent) => {
            if (swapId) void applySwap(swapId, lib, permanent);
          }}
        />
      ) : null}
    </main>
    {restLeft > 0 ? (
      <RestOverlay
        secondsLeft={restLeft}
        caption={restCaption}
        onSubtract={() => setRestUntil((value) => (value ?? Date.now()) - 15_000)}
        onAdd={() => setRestUntil((value) => (value ?? Date.now()) + 15_000)}
        onSkip={() => setRestUntil(null)}
      />
    ) : null}
    </>
  );

  async function applySwap(sessionExerciseId: string, lib: LibraryExercise, permanent: boolean) {
    const exercise = session.exercises.find((item) => item.id === sessionExerciseId);
    if (!exercise) return;
    const fromId = exercise.exerciseId;
    const suggestion = suggestedWeightKg(
      { ...exercise, exerciseId: lib.id },
      lib,
      gym.sessions.filter((item) => item.id !== session.id),
    );
    const originId = exercise.swappedFromExerciseId ?? fromId;
    const next = patchExercise(exercise.id, (item) => ({
      ...item,
      swappedFromExerciseId: lib.id === originId ? undefined : originId,
      exerciseId: lib.id,
      sets: item.sets.map((set) => ({
        ...set,
        weight: suggestion?.weight ?? null,
        reps: null,
        done: false,
        pr: false,
      })),
    }));
    await update(next);
    if (permanent && gym.week) {
      const slot = gym.week.slots.find((item) => item.id === session.slotId);
      if (slot) await gym.replaceInProgram(slot.sourceDayId, fromId, lib.id);
    }
    setSwapId(null);
    setSubsId(null);
  }
}

function SwapSheet({
  exercise,
  catalog,
  otherEquipment,
  query,
  adding,
  onQuery,
  onOther,
  onClose,
  onAddToggle,
  onCreate,
  onPick,
}: {
  exercise: SessionExercise;
  catalog: LibraryExercise[];
  otherEquipment: boolean;
  query: string;
  adding: boolean;
  onQuery: (value: string) => void;
  onOther: () => void;
  onClose: () => void;
  onAddToggle: () => void;
  onCreate: (input: {
    name: string;
    primary: LibraryExercise["primary"];
    equipment: string;
    pattern: LibraryExercise["pattern"];
  }) => void;
  onPick: (exercise: LibraryExercise, permanent: boolean) => void;
}) {
  const current = catalog.find((item) => item.id === exercise.exerciseId);
  const [custom, setCustom] = useState({
    name: "",
    primary: MUSCLES[0] as LibraryExercise["primary"],
    equipment: "",
    pattern: PATTERNS[0] as LibraryExercise["pattern"],
  });
  const ranked = useMemo(() => {
    if (!current) return [];
    return swapRank(current, catalog, otherEquipment);
  }, [current, catalog, otherEquipment]);
  const searched = query
    ? catalog
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 30)
    : [];
  const [choice, setChoice] = useState<LibraryExercise | null>(null);

  const primaryItems = MUSCLES.map((item) => ({ label: MUSCLE_LABEL[item], value: item }));
  const patternItems = PATTERNS.map((item) => ({ label: PATTERN_LABEL[item], value: item }));

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Swap {current?.name ?? "exercise"}</DrawerTitle>
          <DrawerDescription>Pick a replacement for this session or your program.</DrawerDescription>
        </DrawerHeader>
        <div className="flex max-h-[70dvh] flex-col gap-3 overflow-auto p-4">
          <Toggle variant="outline" pressed={otherEquipment} onPressedChange={() => onOther()}>
            Other equipment
          </Toggle>
          <h3 className="text-sm font-medium text-muted-foreground">Same muscles</h3>
          <ul className="flex flex-col gap-2">
            {ranked.slice(0, 12).map(({ exercise: item }) => (
              <li key={item.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full flex-col items-start"
                  onClick={() => setChoice(item)}
                >
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">
                    {PATTERN_LABEL[item.pattern]} · {item.equipment}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          <Field>
            <FieldLabel htmlFor="swap-search">Search</FieldLabel>
            <Input id="swap-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search" />
          </Field>
          <ul className="flex flex-col gap-2">
            {searched.map((item) => (
              <li key={item.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start"
                  onClick={() => setChoice(item)}
                >
                  {item.name}
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="link" className="self-start" onClick={onAddToggle}>
            Add exercise
          </Button>
          {adding ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onCreate(custom);
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="swap-name">Name</FieldLabel>
                  <Input
                    required
                    id="swap-name"
                    placeholder="Name"
                    value={custom.name}
                    onChange={(event) => setCustom({ ...custom, name: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="swap-primary">Muscle</FieldLabel>
                  <Select
                    items={primaryItems}
                    value={custom.primary}
                    onValueChange={(value) => {
                      if (value) setCustom({ ...custom, primary: value as LibraryExercise["primary"] });
                    }}
                  >
                    <SelectTrigger id="swap-primary" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {primaryItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="swap-equipment">Equipment</FieldLabel>
                  <Input
                    required
                    id="swap-equipment"
                    placeholder="Equipment"
                    value={custom.equipment}
                    onChange={(event) => setCustom({ ...custom, equipment: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="swap-pattern">Pattern</FieldLabel>
                  <Select
                    items={patternItems}
                    value={custom.pattern}
                    onValueChange={(value) => {
                      if (value) setCustom({ ...custom, pattern: value as LibraryExercise["pattern"] });
                    }}
                  >
                    <SelectTrigger id="swap-pattern" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {patternItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" variant="outline" className="w-full">Save and use this session</Button>
              </FieldGroup>
            </form>
          ) : null}
          {choice ? (
            <div className="flex flex-col gap-2">
              <p className="font-medium">{choice.name}</p>
              <Button type="button" onClick={() => onPick(choice, false)}>This session only</Button>
              <Button type="button" variant="outline" onClick={() => onPick(choice, true)}>Use in my program</Button>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
