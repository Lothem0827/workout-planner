"use client";

import { EllipsisVerticalIcon, SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DayMuscle } from "@/components/day-muscle";
import { StackHeader } from "@/components/stack-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGym } from "@/lib/gym";
import { activeSessionForSlot, workingSetCount } from "@/lib/logic";
import type { PlannedExercise, WeekSlot } from "@/lib/types";

export function PlanScreen({ planId }: { planId: string }) {
  const gym = useGym();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ name: string; exercises: PlannedExercise[] } | null>(null);
  const selectRef = useRef(gym.selectProgram);
  selectRef.current = gym.selectProgram;

  useEffect(() => {
    if (!gym.ready || gym.program?.id === planId) return;
    void selectRef.current(planId);
  }, [gym.ready, gym.program?.id, planId]);

  const program = gym.programs.find((item) => item.id === planId) ?? null;

  async function startDay(slotId: string) {
    const existing = activeSessionForSlot(slotId, gym.sessions);
    const id = existing?.id ?? (await gym.startSlot(slotId));
    if (id) router.push(`/workout?session=${id}`);
  }

  async function remove() {
    if (pending) return;
    setPending(true);
    try {
      await gym.deleteProgram(planId);
      router.push("/train");
    } finally {
      setPending(false);
      setConfirmDelete(false);
    }
  }

  if (!gym.ready) {
    return (
      <main className="min-h-dvh bg-background">
        <StackHeader title="Workout" fallback="/train" />
        <div className="flex flex-col gap-4 px-4 py-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="min-h-dvh bg-background">
        <StackHeader title="Workout" fallback="/train" />
        <div className="px-4 py-4">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Workout not found</EmptyTitle>
              <EmptyDescription>This plan is no longer saved.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    );
  }

  const outline = program.weeks?.length
    ? program.weeks
    : [{ week: program.weekIndex ?? 1, days: program.days }];
  const currentWeek = program.weekIndex ?? outline[0]?.week ?? 1;
  const activeWeek = outline.some((week) => week.week === selectedWeek) ? selectedWeek! : currentWeek;
  const week = outline.find((item) => item.week === activeWeek) ?? outline[0];
  const live = gym.program?.id === program.id ? gym.week : null;
  const isCurrent = week != null && week.week === currentWeek && live != null;
  const days = !week
    ? []
    : isCurrent
      ? live.slots
          .filter((slot) => slot.status !== "dropped")
          .map((slot) => ({
            id: slot.id,
            name: slot.name,
            exercises: slot.exercises,
            slot,
          }))
      : week.days.map((day) => ({
          id: day.id,
          name: day.name,
          exercises: day.exercises,
          slot: null as WeekSlot | null,
        }));

  return (
    <main className="min-h-dvh bg-background">
      <StackHeader
        title={program.name}
        fallback="/train"
        below={
          <WeekScroller>
            <ToggleGroup
              className="w-max"
              value={[String(activeWeek)]}
              onValueChange={(value) => {
                const next = Number(value[0]);
                if (Number.isFinite(next)) setSelectedWeek(next);
              }}
            >
              {outline.map((item) => (
                <ToggleGroupItem key={item.week} className="touch-pan-y" value={String(item.week)}>
                  Week {item.week}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </WeekScroller>
        }
      >
        <Button
          type="button"
          className="mr-2 shrink-0"
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
        </Button>
      </StackHeader>
      <div className="flex flex-col gap-3 px-4 py-4">
        {days.map((day) => {
          const inProgress = day.slot ? activeSessionForSlot(day.slot.id, gym.sessions) : null;
          const canStart = day.slot?.status === "pending";
          const count = day.exercises.length;
          const primaries = day.exercises.flatMap((exercise) => {
            const muscle = gym.map.get(exercise.exerciseId)?.primary;
            return muscle ? [muscle] : [];
          });
          return (
            <Card key={day.id}>
              <div className="flex items-center gap-3 px-(--card-spacing)">
                <DayMuscle primaries={primaries} />
                <div className="min-w-0 flex-1">
                  <CardTitle>{day.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {count} {count === 1 ? "exercise" : "exercises"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canStart ? (
                    <Button type="button" size="sm" onClick={() => void startDay(day.slot!.id)}>
                      {inProgress ? "Resume" : "Start"}
                    </Button>
                  ) : day.slot?.status === "done" ? (
                    <Badge variant="success">Done</Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${day.name} exercises`}
                    onClick={() => setDetail({ name: day.name, exercises: day.exercises })}
                  >
                    <EllipsisVerticalIcon />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Drawer open={detail != null} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{detail?.name ?? "Exercises"}</DrawerTitle>
          </DrawerHeader>
          <ul className="flex max-h-[70dvh] flex-col gap-3 overflow-auto p-4">
            {detail?.exercises.map((exercise) => (
              <li key={exercise.id} className="flex items-baseline justify-between gap-3">
                <span>{exerciseName(exercise, gym.map)}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{repLine(exercise)}</span>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Settings</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setSettingsOpen(false);
                void selectRef.current(program.id).then(() => router.push("/train/edit"));
              }}
            >
              Edit workout
            </Button>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Unit</span>
              <ToggleGroup
                value={[gym.settings.unit]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next === "kg" || next === "lb") void gym.setUnit(next);
                }}
              >
                <ToggleGroupItem value="kg">kg</ToggleGroupItem>
                <ToggleGroupItem value="lb">lb</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setSettingsOpen(false);
                void gym.restartWeek(program.id);
              }}
            >
              Start again
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => {
                setSettingsOpen(false);
                setConfirmDelete(true);
              }}
            >
              Delete workout
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
      <Drawer
        open={confirmDelete}
        onOpenChange={(open) => { if (!open && !pending) setConfirmDelete(false); }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete {program.name}</DrawerTitle>
            <DrawerDescription>
              This removes the plan and its current week. Finished workouts stay in your log.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="destructive" className="w-full" disabled={pending} onClick={() => void remove()}>
              Delete
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}

function WeekScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ id: -1, x: 0, left: 0, moved: false });

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    drag.current = { id: event.pointerId, x: event.clientX, left: el.scrollLeft, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || drag.current.id !== event.pointerId) return;
    const dx = event.clientX - drag.current.x;
    if (!drag.current.moved && Math.abs(dx) < 8) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = drag.current.left - dx;
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.id !== event.pointerId) return;
    drag.current.id = -1;
  }

  return (
    <div
      ref={ref}
      className="min-w-0 cursor-grab touch-pan-y overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      onPointerDownCapture={onPointerDown}
      onPointerMoveCapture={onPointerMove}
      onPointerUpCapture={onPointerUp}
      onPointerCancelCapture={() => {
        drag.current.id = -1;
      }}
      onClickCapture={(event) => {
        if (!drag.current.moved) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current.moved = false;
      }}
    >
      {children}
    </div>
  );
}

function exerciseName(exercise: PlannedExercise, map: Map<string, { name: string }>) {
  return map.get(exercise.exerciseId)?.name ?? "Exercise";
}

function repLine(exercise: PlannedExercise) {
  const sets = workingSetCount(exercise);
  const reps = exercise.repRange?.trim()
    || (exercise.repMin || exercise.repMax ? `${exercise.repMin}–${exercise.repMax}` : "");
  if (sets > 0 && reps) return `${sets} × ${reps}`;
  if (reps) return reps;
  return sets > 0 ? `${sets} sets` : "";
}
