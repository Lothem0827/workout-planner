"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeftRightIcon, CheckIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { StackHeader } from "@/components/stack-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { useGym } from "@/lib/gym";
import {
  activeSessionForWeek,
  doneSetCount,
  lastLoggedExercise,
  restMs,
  suggestedWeightKg,
  swapRank,
  uid,
  volumeKg,
} from "@/lib/logic";
import { catalogGifUrl } from "@/lib/media";
import { demoUrlFor, youtubeEmbed } from "@/lib/minmax";
import { formatLoad, formatWeight, toKg } from "@/lib/units";
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
  const [otherEquipment, setOtherEquipment] = useState(true);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

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
  if (!active) {
    return (
      <main className="min-h-dvh bg-background">
        <StackHeader title="Workout" fallback="/" />
        <div className="px-4 py-4">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No workout in progress</EmptyTitle>
              <EmptyDescription>Start a day from Home or Train.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    );
  }

  const seconds = Math.max(0, Math.floor((now - active.startedAt) / 1000));
  const clock = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const restLeft = restUntil
    ? Math.max(0, Math.ceil((restUntil - now) / 1000))
    : 0;

  async function update(next: Session) {
    await gym.saveSession(next);
  }

  function patchExercise(
    exerciseId: string,
    patch: (exercise: SessionExercise) => SessionExercise,
  ) {
    return {
      ...active!,
      exercises: active!.exercises.map((exercise) =>
        exercise.id === exerciseId ? patch(exercise) : exercise,
      ),
    };
  }

  return (
    <main className="min-h-dvh bg-background">
      <StackHeader
        title={active.name}
        fallback="/"
        detail={`${clock} · ${formatLoad(volumeKg(active), gym.settings.unit)} · ${doneSetCount(active)} sets`}
      >
        <Button
          type="button"
          className="mr-2 shrink-0"
          onClick={async () => {
            await gym.finishSession(active.id);
            router.push("/");
          }}
        >
          Finish
        </Button>
      </StackHeader>
      <div className="flex flex-col gap-6 px-4 py-4 pb-28">
        {active.exercises.map((exercise) => {
          const lib = gym.map.get(exercise.exerciseId);
          const name = lib?.name ?? "Exercise";
          const priorSessions = gym.sessions.filter(
            (session) => session.id !== active.id,
          );
          const previous = lastLoggedExercise(
            exercise.exerciseId,
            priorSessions,
          );
          const previousSets =
            previous?.sets.filter(
              (set) => set.done && set.weight != null && set.reps != null,
            ) ?? [];
          const suggestion = suggestedWeightKg(exercise, lib, priorSessions);
          const rirFor = (index: number) =>
            index === 0 ? exercise.rirSet1 : exercise.rirSet2;
          const priorRir = (index: number) =>
            index === 0 ? previous?.rirSet1 : previous?.rirSet2;
          const embed = youtubeEmbed(
            demoUrlFor(name, gym.program?.builtin) ?? exercise.videoUrl,
          );
          const gif = embed ? null : catalogGifUrl(lib?.id);
          const minmax = Boolean(exercise.substitution1 || exercise.substitution2);
          const mainLib = exercise.swappedFromExerciseId
            ? gym.map.get(exercise.swappedFromExerciseId)
            : lib;
          const substitutions = [
            exercise.substitution1,
            exercise.substitution2,
          ].flatMap((option, index) => {
            if (!option || option === "See Notes") return [];
            const match = gym.exercises.find(
              (item) => item.name.toLowerCase() === option.toLowerCase(),
            );
            if (!match || match.id === exercise.exerciseId) return [];
            return [{ key: `sub-${index + 1}`, slot: index + 1, option, lib: match, main: false }];
          });
          if (mainLib && mainLib.id !== exercise.exerciseId) {
            substitutions.unshift({
              key: "main",
              slot: 0,
              option: mainLib.name,
              lib: mainLib,
              main: true,
            });
          }
          const isMain = Boolean(mainLib && mainLib.id === exercise.exerciseId);
          return (
            <Card key={exercise.id}>
              <CardHeader>
                {active.weekIndex ? (
                  <p className="text-xs text-muted-foreground">Week {active.weekIndex}</p>
                ) : null}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <CardTitle>{name}</CardTitle>
                    {minmax && isMain ? <Badge variant="secondary">Main</Badge> : null}
                  </div>
                  {minmax ? null : (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setSwapId(exercise.id);
                        setOtherEquipment(true);
                        setQuery("");
                      }}
                    >
                      Swap
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
              {embed ? (
                <div className="mb-3 aspect-video overflow-hidden rounded-xl bg-black">
                  <iframe
                    className="h-full w-full"
                    src={embed}
                    title={`${name} demo`}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : gif ? (
                <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-white">
                  <Image
                    src={gif}
                    alt={`${name} demo`}
                    width={180}
                    height={180}
                    unoptimized
                    className="size-44 object-contain"
                  />
                </div>
              ) : null}
              <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <dt>Last-set intensity</dt>
                  <dd className="text-right text-foreground">
                    {exercise.technique || "N/A"}
                  </dd>
                </div>
                {exercise.warmupSets ? (
                  <div className="flex justify-between gap-3">
                    <dt>Warm-up sets</dt>
                    <dd className="text-foreground">{exercise.warmupSets}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt>Working sets</dt>
                  <dd className="text-foreground">
                    {exercise.workingSets || exercise.setsTarget}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Rep range</dt>
                  <dd className="text-foreground">
                    {exercise.repRange ||
                      `${exercise.repMin}–${exercise.repMax}`}
                  </dd>
                </div>
                {exercise.rpe ? (
                  <div className="flex justify-between gap-3">
                    <dt>RPE</dt>
                    <dd className="text-foreground">{exercise.rpe}</dd>
                  </div>
                ) : null}
                {exercise.rest ? (
                  <div className="flex justify-between gap-3">
                    <dt>Rest</dt>
                    <dd className="text-foreground">{exercise.rest}</dd>
                  </div>
                ) : null}
              </dl>
              {exercise.notes ? (
                <p className="mt-3 text-sm text-foreground">{exercise.notes}</p>
              ) : null}
              {previousSets.length ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Previous{" "}
                  {previousSets
                    .map(
                      (set, index) =>
                        `${formatWeight(set.weight, gym.settings.unit)}×${set.reps}${priorRir(index) ? ` RIR ${priorRir(index)}` : ""}${index === 0 && !priorRir(0) && previous?.rpe ? ` RPE ${previous.rpe}` : ""}`,
                    )
                    .join(", ")}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Previous —</p>
              )}
              {suggestion != null ? (
                <p className="text-sm text-muted-foreground">
                  Next {formatWeight(suggestion.weight, gym.settings.unit)}{" "}
                  {gym.settings.unit}
                </p>
              ) : null}
              <div className="mt-3 grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,4.5rem)_2.75rem] gap-2 text-xs text-muted-foreground">
                <span>Set</span>
                <span>{gym.settings.unit}</span>
                <span>Reps</span>
                <span />
              </div>
              {exercise.sets.map((set, index) => (
                <div
                  key={set.id}
                  className="mt-2 grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,4.5rem)_2.75rem] items-center gap-2"
                >
                  <span className="text-sm">
                    {index + 1}
                    {set.pr ? " PR" : ""}
                    {rirFor(index) ? (
                      <span className="block text-xs text-muted-foreground">
                        RIR {rirFor(index)}
                      </span>
                    ) : exercise.rpe ? (
                      <span className="block text-xs text-muted-foreground">
                        RPE {exercise.rpe}
                      </span>
                    ) : null}
                  </span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Set ${index + 1} load`}
                    value={formatWeight(set.weight, gym.settings.unit)}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const weight =
                        raw === ""
                          ? null
                          : toKg(Number(raw), gym.settings.unit);
                      void update(
                        patchExercise(exercise.id, (item) => ({
                          ...item,
                          sets: item.sets.map((row) =>
                            row.id === set.id ? { ...row, weight } : row,
                          ),
                        })),
                      );
                    }}
                    className="min-w-0 tabular-nums"
                  />
                  <Input
                    inputMode="numeric"
                    aria-label={`Set ${index + 1} reps`}
                    value={set.reps ?? ""}
                    onChange={(event) => {
                      const reps =
                        event.target.value === ""
                          ? null
                          : Number(event.target.value);
                      void update(
                        patchExercise(exercise.id, (item) => ({
                          ...item,
                          sets: item.sets.map((row) =>
                            row.id === set.id ? { ...row, reps } : row,
                          ),
                        })),
                      );
                    }}
                    className="min-w-0 tabular-nums"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant={set.done ? "default" : "outline"}
                    aria-label={set.done ? "Completed set" : "Complete set"}
                    onClick={() => {
                      const done = !set.done;
                      void update(
                        patchExercise(exercise.id, (item) => ({
                          ...item,
                          sets: item.sets.map((row) =>
                            row.id === set.id ? { ...row, done } : row,
                          ),
                        })),
                      );
                      if (done) setRestUntil(Date.now() + restMs(exercise.rest));
                    }}
                  >
                    <CheckIcon />
                  </Button>
                </div>
              ))}
              {substitutions.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Substitutions</p>
                  {substitutions.map(({ key, option, lib: swap, main }) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full justify-between px-3"
                      onClick={() => {
                        void applySwap(exercise.id, swap, false);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-left">
                        <span className="truncate">{option}</span>
                        {main ? <Badge variant="secondary">Main</Badge> : null}
                      </span>
                      <ArrowLeftRightIcon data-icon="inline-end" />
                    </Button>
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                variant="link"
                className="self-start"
                onClick={() => {
                  void update(
                    patchExercise(exercise.id, (item) => ({
                      ...item,
                      sets: [
                        ...item.sets,
                        {
                          id: uid(),
                          weight: suggestion?.weight ?? null,
                          reps: null,
                          done: false,
                        },
                      ],
                    })),
                  );
                }}
              >
                Add set
              </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {restUntil && restLeft > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-4xl font-semibold tabular-nums">
            {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() =>
                setRestUntil((value) => (value ?? Date.now()) - 15_000)
              }
            >
              −15s
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() =>
                setRestUntil((value) => (value ?? Date.now()) + 15_000)
              }
            >
              +15s
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => setRestUntil(null)}
            >
              Skip
            </Button>
          </div>
        </div>
      ) : null}
      {swapId ? (
        <SwapSheet
          exercise={active.exercises.find((item) => item.id === swapId)!}
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
  );

  async function applySwap(sessionExerciseId: string, lib: LibraryExercise, permanent: boolean) {
    const exercise = active!.exercises.find((item) => item.id === sessionExerciseId);
    if (!exercise) return;
    const fromId = exercise.exerciseId;
    const suggestion = suggestedWeightKg(
      { ...exercise, exerciseId: lib.id },
      lib,
      gym.sessions.filter((session) => session.id !== active!.id),
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
      const slot = gym.week.slots.find((item) => item.id === active!.slotId);
      if (slot) await gym.replaceInProgram(slot.sourceDayId, fromId, lib.id);
    }
    setSwapId(null);
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
