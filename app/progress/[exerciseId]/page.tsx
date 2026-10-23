"use client";

import { use, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { StackHeader } from "@/components/stack-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";
import { bestE1rm, chartPoints, nextTargetLine, suggestedWeightKg } from "@/lib/logic";
import { formatLoad, formatWeight } from "@/lib/units";

const chartConfig = {
  e1rm: { label: "e1RM", color: "var(--foreground)" },
} satisfies ChartConfig;

export default function ExerciseProgressPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = use(params);
  const gym = useGym();
  const lib = gym.map.get(exerciseId);
  const points = chartPoints(exerciseId, gym.sessions).map((point) => ({
    date: point.date,
    e1rm: gym.settings.unit === "lb" ? point.value * 2.2046226218 : point.value,
  }));
  const record = bestE1rm(exerciseId, gym.sessions);
  const next = lib
    ? suggestedWeightKg(
        { id: "x", exerciseId, setsTarget: 1, repMin: 0, repMax: 0, sets: [] },
        lib,
        gym.sessions,
      )
    : null;
  const [notes, setNotes] = useState(lib?.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setNotes(lib?.notes ?? "");
  }, [lib?.notes]);

  if (!gym.ready) {
    return (
      <main>
        <StackHeader title={lib?.name ?? "Exercise"} fallback="/progress" />
        <div className="flex flex-col gap-4 px-4 py-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main>
      <StackHeader title={lib?.name ?? "Exercise"} fallback="/progress" />
      <div className="flex flex-col gap-4 px-4 py-4">
        <Card>
          <CardHeader>
            <CardDescription>Estimated 1RM</CardDescription>
            <p className="text-3xl font-semibold tabular-nums">
              {record.best ? formatLoad(record.best, gym.settings.unit) : "—"}
            </p>
            <CardDescription>
              Best set {record.best ? `${formatWeight(record.weight, gym.settings.unit)} × ${record.reps}` : "—"}
            </CardDescription>
            {next != null ? <p>{nextTargetLine(next, gym.settings.unit)}</p> : null}
            {record.best ? (
              <Button type="button" variant="ghost" className="mt-2 w-fit text-destructive" onClick={() => setConfirm(true)}>
                Remove record
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {points.length ? (
              <ChartContainer config={chartConfig} className="aspect-video w-full">
                <LineChart data={points} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="e1rm" type="monotone" stroke="var(--color-e1rm)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No chart yet</EmptyTitle>
                  <EmptyDescription>Log this exercise to see the chart.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>Notes</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if (notes.trim() !== (lib?.notes ?? "").trim()) void gym.saveExerciseNotes(exerciseId, notes);
            }}
            className="min-h-16 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </label>
      </div>
      <Drawer
        open={confirm}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(false);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Remove this record?</DrawerTitle>
            <DrawerDescription>The set stays in your log. The next-best set becomes the PR.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void gym.ignorePr(exerciseId).finally(() => {
                  setPending(false);
                  setConfirm(false);
                });
              }}
            >
              Remove
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
