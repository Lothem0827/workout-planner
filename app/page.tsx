"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BodyMap } from "@/components/body-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGym } from "@/lib/gym";
import {
  activeSessionForSlot,
  fatigueScore,
  lastTrained,
  pickToday,
  primariesOf,
  readyInHours,
  recoveryState,
  scoreForSlot,
} from "@/lib/logic";
import { cn } from "@/lib/utils";
import { MUSCLE_LABEL, MUSCLES, type Muscle, type PlannedExercise, type RecoveryState } from "@/lib/types";

const PREVIEW = 4;

const DOT: Record<RecoveryState, string> = {
  fresh: "bg-recovery-fresh",
  recovering: "bg-recovery-recovering",
  fatigued: "bg-recovery-fatigued",
};

export default function HomePage() {
  const gym = useGym();
  const router = useRouter();
  const [side, setSide] = useState<"front" | "back">("front");
  const [picked, setPicked] = useState<Muscle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const states = useMemo(() => {
    const next = {} as Record<Muscle, RecoveryState>;
    for (const muscle of MUSCLES) {
      next[muscle] = recoveryState(fatigueScore(muscle, gym.sessions, gym.map));
    }
    return next;
  }, [gym.sessions, gym.map]);

  const today = pickToday(gym.week, gym.map, gym.sessions);
  const strip = gym.week?.slots.filter((slot) => slot.status !== "dropped") ?? [];
  const selected = strip.find((slot) => slot.id === selectedId) ?? today?.slot ?? null;
  const selectedSession = selected ? activeSessionForSlot(selected.id, gym.sessions) : null;
  const switching = Boolean(today && selected && selected.id !== today.slot.id);
  const index = selected ? strip.findIndex((slot) => slot.id === selected.id) + 1 : 0;
  const total = strip.length;
  const preview = selected?.exercises.slice(0, PREVIEW) ?? [];
  const more = selected ? Math.max(0, selected.exercises.length - preview.length) : 0;
  const muscles = selected ? [...primariesOf(selected.exercises, gym.map)] : [];
  const notRecommended = selected ? scoreForSlot(selected, gym.map, gym.sessions).notRecommended : false;
  const canStart = Boolean(selected && selected.status !== "done");
  const pendingCount = gym.week?.slots.filter((slot) => slot.status === "pending").length ?? 0;

  function openSession(id: string) {
    router.push(`/workout?session=${id}`);
  }

  async function begin(slotId: string) {
    const id = await gym.startSlot(slotId);
    if (id) openSession(id);
  }

  function launch(slotId: string) {
    const session = activeSessionForSlot(slotId, gym.sessions);
    if (session) openSession(session.id);
    else void begin(slotId);
  }

  function startWorkout() {
    if (!selected || !canStart) return;
    if (switching) {
      setConfirming(true);
      return;
    }
    launch(selected.id);
  }

  if (!gym.ready) {
    return (
      <main className="flex flex-col gap-4 px-4 py-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </main>
    );
  }

  return (
    <main className={cn("flex flex-col gap-4 px-4 pt-5", canStart ? "pb-28" : "pb-5")}>
      {today ? (
        <ol className="flex gap-2 overflow-x-auto">
          {strip.map((slot) => {
            const current = slot.id === selected?.id;
            const isToday = slot.id === today.slot.id;
            const done = slot.status === "done";
            return (
              <li key={slot.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={current}
                  onClick={() => setSelectedId(slot.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    current && "border-primary bg-primary text-primary-foreground",
                    !current && done && "border-transparent bg-muted text-muted-foreground",
                    !current && !done && isToday && "border-primary",
                    !current && !done && !isToday && "border-border",
                  )}
                >
                  <span className="sr-only">{isToday ? "Today" : done ? "Done" : "Pending"}. </span>
                  {slot.name}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      {!gym.program ? (
        <Card>
          <CardHeader>
            <CardTitle>Build a program</CardTitle>
            <CardDescription>Set the days you want to repeat each pass.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" render={<Link href="/train/edit?new=1" />} nativeButton={false}>
              Add a plan
            </Button>
          </CardFooter>
        </Card>
      ) : today && selected ? (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{selected.name}</h1>
          <p className="text-sm text-muted-foreground">
            {gym.program.weeks?.length ? `Week ${gym.program.weekIndex ?? 1} of ${gym.program.weeks.length} · ` : ""}
            Day {index} of {total}
          </p>
          {pendingCount > 1 ? (
            <Button
              variant="link"
              className="h-auto justify-start px-0"
              render={<Link href="/train/shorten" />}
              nativeButton={false}
            >
              Fit this week
            </Button>
          ) : null}
          {notRecommended ? <Badge variant="destructive">Not recommended</Badge> : null}
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">
              {gym.program.weeks?.length
                ? `Week ${gym.program.weekIndex ?? gym.program.weeks.length} of ${gym.program.weeks.length} is complete.`
                : "This pass is complete. The next one uses your original program."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <ToggleGroup
            className="mx-auto"
            value={[side]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "front" || next === "back") setSide(next);
            }}
          >
            <ToggleGroupItem value="front">Front</ToggleGroupItem>
            <ToggleGroupItem value="back">Back</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <BodyMap side={side} states={states} picked={picked} onPick={setPicked} />
          <RecoveryLegend />
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {preview.map((exercise) => (
                <li key={exercise.id} className="flex items-baseline justify-between gap-3">
                  <span>{gym.map.get(exercise.exerciseId)?.name ?? "Exercise"}</span>
                  <span className="shrink-0 text-muted-foreground">{prescription(exercise)}</span>
                </li>
              ))}
            </ul>
            {more > 0 ? <p className="text-muted-foreground">{more} more</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {selected && muscles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {muscles.map((muscle) => (
            <Button key={muscle} type="button" variant="outline" onClick={() => setPicked(muscle)}>
              <i className={cn("size-2 rounded-full", DOT[states[muscle]])} />
              {MUSCLE_LABEL[muscle]}
            </Button>
          ))}
        </div>
      ) : null}

      {canStart ? (
        <div className="fixed inset-x-0 z-30 border-t bg-background bottom-[calc(env(safe-area-inset-bottom)+2.75rem+var(--active-bar-height,0px))]">
          <div className="mx-auto flex max-w-md px-4 py-3">
            <Button className="w-full" size="lg" onClick={startWorkout}>
              Start workout
            </Button>
          </div>
        </div>
      ) : null}

      <Drawer open={confirming} onOpenChange={setConfirming} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Today is {today?.slot.name}</DrawerTitle>
            <DrawerDescription>
              {selectedSession ? "Continue" : "Start"} {selected?.name} instead?
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                const slotId = selected?.id;
                setConfirming(false);
                if (slotId) launch(slotId);
              }}
            >
              {selectedSession ? "Continue" : "Start"} {selected?.name}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={picked != null} onOpenChange={(open) => { if (!open) setPicked(null); }}>
        <DrawerContent>
          {picked ? (
            <MuscleDetail muscle={picked} sessions={gym.sessions} map={gym.map} />
          ) : null}
        </DrawerContent>
      </Drawer>

    </main>
  );
}

function prescription(exercise: PlannedExercise) {
  const reps = exercise.repMin === exercise.repMax
    ? `${exercise.repMin}`
    : `${exercise.repMin}–${exercise.repMax}`;
  const sets = exercise.sets === 1 ? "1 set" : `${exercise.sets} sets`;
  return `${sets} · ${reps}`;
}

function RecoveryLegend() {
  return (
    <div className="flex justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-recovery-fresh" />Fresh</span>
      <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-recovery-recovering" />Recovering</span>
      <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-recovery-fatigued" />Fatigued</span>
    </div>
  );
}

function MuscleDetail({
  muscle,
  sessions,
  map,
}: {
  muscle: Muscle;
  sessions: ReturnType<typeof useGym>["sessions"];
  map: ReturnType<typeof useGym>["map"];
}) {
  const score = fatigueScore(muscle, sessions, map);
  const hours = readyInHours(muscle, score);
  const last = lastTrained(muscle, sessions, map);
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{MUSCLE_LABEL[muscle]}</DrawerTitle>
        <DrawerDescription className="capitalize">{recoveryState(score)}</DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-1 p-4">
        <p>{last ? `Last trained ${new Date(last).toLocaleDateString()}` : "Not trained yet"}</p>
        <p className="text-muted-foreground">
          {hours <= 0 ? "Ready now" : `Ready in about ${Math.ceil(hours)} hours`}
        </p>
      </div>
    </>
  );
}
