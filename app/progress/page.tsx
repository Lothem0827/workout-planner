"use client";

import Link from "next/link";
import { SettingsIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";
import { bestE1rm, nextTargetLine, suggestedWeightKg } from "@/lib/logic";
import { formatLoad, formatWeight } from "@/lib/units";

export default function ProgressPage() {
  const gym = useGym();
  const [cursor, setCursor] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<"plan" | "data" | null>(null);
  const [pending, setPending] = useState(false);
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

  function ask(next: "plan" | "data") {
    setSettingsOpen(false);
    setConfirm(next);
  }

  async function confirmAction() {
    if (!confirm || pending) return;
    setPending(true);
    try {
      if (confirm === "plan" && gym.program) await gym.deleteProgram(gym.program.id);
      if (confirm === "data") await gym.clearAllData();
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
        </Button>
      </div>
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
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Settings</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pt-6 pb-4">
            {gym.program ? (
              <Button type="button" variant="destructive" className="w-full" onClick={() => ask("plan")}>
                Delete workout plan
              </Button>
            ) : null}
            <Button type="button" variant="destructive" className="w-full" onClick={() => ask("data")}>
              Clear all data
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
      <Drawer
        open={confirm != null}
        onOpenChange={(open) => { if (!open && !pending) setConfirm(null); }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {confirm === "plan" ? `Delete ${gym.program?.name ?? "workout plan"}` : "Clear all data"}
            </DrawerTitle>
            <DrawerDescription>
              {confirm === "plan"
                ? "This removes the plan and its current week. Finished workouts stay in your log."
                : "Workouts, programs, and custom exercises will be removed. This cannot be undone."}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="destructive" className="w-full" disabled={pending} onClick={() => void confirmAction()}>
              {confirm === "plan" ? "Delete" : "Clear"}
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
