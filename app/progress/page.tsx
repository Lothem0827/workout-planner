"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";
import { bestE1rm, nextTargetLine, suggestedWeightKg } from "@/lib/logic";
import { formatLoad, formatWeight } from "@/lib/units";

export default function ProgressPage() {
  const gym = useGym();
  const [cursor, setCursor] = useState(() => new Date());
  const trained = useMemo(
    () => new Set(gym.sessions.filter((session) => session.status === "finished").map((session) => session.date)),
    [gym.sessions],
  );
  const logged = useMemo(() => {
    const ids = new Set<string>();
    for (const session of gym.sessions) {
      if (session.status !== "finished") continue;
      for (const exercise of session.exercises) ids.add(exercise.exerciseId);
    }
    return [...ids];
  }, [gym.sessions]);
  const records = logged.flatMap((id) => {
    const record = bestE1rm(id, gym.sessions);
    if (!record.best) return [];
    const lib = gym.map.get(id);
    const next = lib
      ? suggestedWeightKg(
          { id: "x", exerciseId: id, setsTarget: 1, repMin: 0, repMax: 0, sets: [] },
          lib,
          gym.sessions,
        )
      : null;
    return [{ id, record, lib, next }];
  });

  if (!gym.ready) {
    return (
      <main className="flex flex-col gap-4 px-4 py-5">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-semibold">Progress</h1>
      <MonthCalendar trained={trained} cursor={cursor} onCursor={setCursor} />
      <Card>
        <CardHeader>
          <CardTitle>Personal records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No records yet</EmptyTitle>
                <EmptyDescription>Finish a workout to see records.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {records.map(({ id, record, lib, next }) => (
                <li key={id}>
                  <Link href={`/progress/${id}`} className="flex flex-col gap-1">
                    <span className="font-medium">{lib?.name ?? "Exercise"}</span>
                    <span className="text-sm text-muted-foreground">
                      Best set {formatWeight(record.weight, gym.settings.unit)} × {record.reps}
                    </span>
                    <span className="tabular-nums">e1RM {formatLoad(record.best, gym.settings.unit)}</span>
                    {next != null ? (
                      <span className="text-sm text-muted-foreground">{nextTargetLine(next, gym.settings.unit)}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
