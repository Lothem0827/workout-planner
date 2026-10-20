"use client";

import { useState } from "react";
import { useMuscleFigure } from "@/components/body-map";
import { StackHeader } from "@/components/stack-header";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { doneSetCount, formatDate, primariesOf, volumeKg } from "@/lib/logic";
import { formatLoad, formatWeight } from "@/lib/units";
import {
  MUSCLE_LABEL,
  MUSCLES,
  type LibraryExercise,
  type Muscle,
  type Session,
  type SessionExercise,
  type SetLog,
} from "@/lib/types";

const HIGHLIGHT = "#22CD94";
const DIM = "var(--muted)";

export function WorkoutSummary({
  session,
  map,
  unit,
  onDone,
  onDiscard,
}: {
  session: Session;
  map: Map<string, LibraryExercise>;
  unit: "kg" | "lb";
  onDone: () => void;
  onDiscard?: () => void | Promise<void>;
}) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const logged = session.exercises.filter((exercise) => exercise.sets.some((set) => set.done));
  const groups = groupByPrimary(logged, map);
  const trained = primariesOf(logged, map);
  const muscles = MUSCLES.filter((muscle) => trained.has(muscle));
  const finishedAt = session.finishedAt ?? session.startedAt;
  const prs = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done && set.pr).length,
    0,
  );
  const when = new Date(finishedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const canDiscard = logged.length === 0 && onDiscard != null;

  return (
    <main className="-mb-[env(safe-area-inset-bottom)] flex h-dvh flex-col overflow-hidden bg-background">
      <StackHeader title={session.name} fallback="/" detail={`${formatDate(session.date)} · ${when}`} />
      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-4 py-4">
        <dl className="grid grid-cols-4 gap-2">
          <Stat label="Duration" value={formatDuration(session.startedAt, finishedAt)} />
          <Stat label="Volume" value={formatLoad(volumeKg(session), unit)} />
          <Stat label="Sets" value={String(doneSetCount(session))} />
          <Stat label="PRs" value={String(prs)} />
        </dl>
        {muscles.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Muscles</h2>
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="flex flex-col items-center gap-1">
                <TrainedFigure file="Front" trained={trained} className="h-56" />
                <p className="text-xs text-muted-foreground">Front</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <TrainedFigure file="Back" trained={trained} className="h-56" />
                <p className="text-xs text-muted-foreground">Back</p>
              </div>
            </div>
            <p className="text-sm">{muscles.map((muscle) => MUSCLE_LABEL[muscle]).join(", ")}</p>
          </section>
        ) : null}
        <section className="flex flex-col gap-6">
          {logged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sets were logged.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-4">
                <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
                {group.exercises.map((exercise) => (
                  <div key={exercise.id} className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold">{map.get(exercise.exerciseId)?.name ?? "Exercise"}</h3>
                    <ul className="flex flex-col gap-1">
                      {exercise.sets.map((set, index) =>
                        set.done ? (
                          <li key={set.id} className="flex items-baseline gap-3 text-sm">
                            <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{index + 1}</span>
                            <span className="tabular-nums">{setLine(set, unit)}</span>
                            {set.pr ? <span className="text-xs font-medium">PR</span> : null}
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
      <div className="flex shrink-0 flex-col gap-2 bg-background px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {canDiscard ? (
          <Button
            type="button"
            variant="destructive"
            className="h-12 w-full text-base"
            onClick={() => setDiscardOpen(true)}
          >
            Discard workout
          </Button>
        ) : null}
        <Button type="button" className="h-12 w-full text-base" onClick={onDone}>
          Done
        </Button>
      </div>
      <Drawer
        open={discardOpen}
        onOpenChange={(open) => {
          if (!open && !discarding) setDiscardOpen(false);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Discard workout</DrawerTitle>
            <DrawerDescription>
              This workout will be removed from your log. {session.name} stays available to start again.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={discarding}
              onClick={() => {
                if (!onDiscard || discarding) return;
                setDiscarding(true);
                void Promise.resolve(onDiscard()).finally(() => {
                  setDiscarding(false);
                  setDiscardOpen(false);
                });
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={discarding}
              onClick={() => setDiscardOpen(false)}
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}

function groupByPrimary(logged: SessionExercise[], map: Map<string, LibraryExercise>) {
  const buckets = new Map<Muscle | "other", SessionExercise[]>();
  for (const exercise of logged) {
    const key = map.get(exercise.exerciseId)?.primary ?? "other";
    const list = buckets.get(key) ?? [];
    list.push(exercise);
    buckets.set(key, list);
  }
  const groups: { key: string; label: string; exercises: SessionExercise[] }[] = MUSCLES.flatMap((muscle) => {
    const exercises = buckets.get(muscle);
    return exercises?.length
      ? [{ key: muscle, label: MUSCLE_LABEL[muscle], exercises }]
      : [];
  });
  const other = buckets.get("other");
  if (other?.length) groups.push({ key: "other", label: "Other", exercises: other });
  return groups;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatDuration(startedAt: number, finishedAt: number) {
  const total = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function setLine(set: SetLog, unit: "kg" | "lb") {
  const weight = set.weight == null ? null : `${formatWeight(set.weight, unit)} ${unit}`;
  const reps = set.reps == null ? null : String(set.reps);
  if (weight && reps) return `${weight} × ${reps}`;
  if (weight) return weight;
  if (reps) return `${reps} reps`;
  return "Logged";
}

function TrainedFigure({
  file,
  trained,
  className,
}: {
  file: string;
  trained: Set<Muscle>;
  className: string;
}) {
  const figure = useMuscleFigure(file);
  if (!figure) return <div className={className} />;
  return (
    <svg viewBox={figure.viewBox} className={`${className} w-auto`} aria-hidden="true">
      {figure.body.map((d, index) => (
        <path key={`body-${index}`} d={d} fill={DIM} />
      ))}
      {figure.muscles.map(({ muscle, paths }) =>
        paths.map((d, index) => (
          <path key={`${muscle}-${index}`} d={d} fill={trained.has(muscle) ? HIGHLIGHT : DIM} />
        )),
      )}
    </svg>
  );
}
