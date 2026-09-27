"use client";

import { use, useState } from "react";
import { StackHeader } from "@/components/stack-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";
import { formatDate } from "@/lib/logic";
import { formatWeight, toKg } from "@/lib/units";
import type { Session } from "@/lib/types";

export default function LogDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const gym = useGym();
  const sessions = gym.sessions
    .filter((session) => session.date === date && session.status === "finished")
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!gym.ready) {
    return (
      <main>
        <StackHeader title={formatDate(date)} fallback="/" />
        <div className="flex flex-col gap-4 px-4 py-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  async function save(next: Session) {
    await gym.saveSession(next);
  }

  return (
    <main>
      <StackHeader title={formatDate(date)} fallback="/" />
      <div className="flex flex-col gap-4 px-4 py-4">
        {sessions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No workout this day</EmptyTitle>
              <EmptyDescription>Finished sessions for this date show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardHeader>
              <CardTitle>{session.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {session.exercises.map((exercise) => (
                <div key={exercise.id} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">{gym.map.get(exercise.exerciseId)?.name}</h3>
                  {exercise.sets.map((set, index) => {
                    const rir = index === 0 ? exercise.rirSet1 : exercise.rirSet2;
                    return (
                      <div key={set.id} className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-2">
                        <span className="text-sm">
                          {index + 1}{set.pr ? " PR" : ""}
                          {rir ? <span className="block text-xs text-muted-foreground">RIR {rir}</span> : exercise.rpe ? <span className="block text-xs text-muted-foreground">RPE {exercise.rpe}</span> : null}
                        </span>
                        <Input
                          inputMode="decimal"
                          value={formatWeight(set.weight, gym.settings.unit)}
                          onChange={(event) => {
                            const weight = event.target.value === "" ? null : toKg(Number(event.target.value), gym.settings.unit);
                            void save({
                              ...session,
                              exercises: session.exercises.map((item) =>
                                item.id !== exercise.id
                                  ? item
                                  : {
                                      ...item,
                                      sets: item.sets.map((row) => row.id === set.id ? { ...row, weight } : row),
                                    },
                              ),
                            });
                          }}
                          className="tabular-nums"
                          aria-label="Weight"
                        />
                        <Input
                          inputMode="numeric"
                          value={set.reps ?? ""}
                          onChange={(event) => {
                            const reps = event.target.value === "" ? null : Number(event.target.value);
                            void save({
                              ...session,
                              exercises: session.exercises.map((item) =>
                                item.id !== exercise.id
                                  ? item
                                  : {
                                      ...item,
                                      sets: item.sets.map((row) => row.id === set.id ? { ...row, reps } : row),
                                    },
                              ),
                            });
                          }}
                          className="tabular-nums"
                          aria-label="Reps"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="destructive" onClick={() => setConfirmId(session.id)}>
                Delete session
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <Drawer open={confirmId != null} onOpenChange={(open) => { if (!open) setConfirmId(null); }} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete session</DrawerTitle>
            <DrawerDescription>This removes the workout from your log.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => {
                if (confirmId) void gym.deleteSession(confirmId);
                setConfirmId(null);
              }}
            >
              Delete
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
