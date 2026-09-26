"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGym } from "@/lib/gym";
import { activeSessionForSlot, activeSessionForWeek } from "@/lib/logic";
import type { Session } from "@/lib/types";

export default function TrainPage() {
  const gym = useGym();
  const router = useRouter();
  const [choice, setChoice] = useState<Session | null>(null);
  const inProgress = activeSessionForWeek(gym.week, gym.sessions);

  function openSession(id: string) {
    router.push(`/workout?session=${id}`);
  }

  async function begin(slotId: string) {
    const id = await gym.startSlot(slotId);
    if (id) openSession(id);
  }

  async function restart(session: Session) {
    const slotId = session.slotId;
    if (!slotId) return;
    await gym.deleteSession(session.id);
    const id = await gym.startSlot(slotId);
    if (id) openSession(id);
  }

  function start(slotId: string) {
    const existing = activeSessionForSlot(slotId, gym.sessions);
    if (existing) {
      setChoice(existing);
      return;
    }
    void begin(slotId);
  }

  if (!gym.ready) {
    return (
      <main className="flex flex-col gap-4 px-4 py-5">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Train</h1>
        <div className="flex items-center gap-2">
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
          <Button className="shrink-0" variant="ghost" render={<Link href="/train/edit?new=1" />} nativeButton={false}>
            Add a plan
            <PlusIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
      {gym.programs.length ? (
        <div className="min-w-0 overflow-x-auto">
          <ToggleGroup
            className="w-max"
            value={gym.program ? [gym.program.id] : []}
            onValueChange={(value) => {
              const next = value[0];
              if (next) void gym.selectProgram(next);
            }}
          >
            {gym.programs.map((plan) => (
              <ToggleGroupItem key={plan.id} value={plan.id}>
                {plan.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      {gym.program ? (
        <section className="flex flex-col gap-3">
          {inProgress ? (
            <Card>
              <CardHeader>
                <CardDescription>Workout in progress</CardDescription>
                <CardTitle>{inProgress.name}</CardTitle>
              </CardHeader>
              <CardFooter className="flex-col items-stretch gap-2">
                <Button className="w-full" onClick={() => openSession(inProgress.id)}>
                  Resume
                </Button>
                <Button className="w-full" variant="outline" onClick={() => void restart(inProgress)}>
                  Start again
                </Button>
              </CardFooter>
            </Card>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{gym.program.name}</h2>
              {gym.program.weeks?.length ? (
                <p className="text-sm text-muted-foreground">Week {gym.program.weekIndex ?? 1} of {gym.program.weeks.length}</p>
              ) : null}
            </div>
            <Button variant="link" render={<Link href="/train/edit" />} nativeButton={false}>Edit</Button>
          </div>
          {(gym.week?.slots ?? []).filter((slot) => slot.status !== "dropped").map((slot) => (
            <Card key={slot.id}>
              <CardHeader>
                <CardTitle>{slot.name}</CardTitle>
                <CardAction>
                  <Badge variant={slot.status === "done" ? "success" : "secondary"}>{slot.status}</Badge>
                </CardAction>
                <CardDescription>
                  {slot.exercises
                    .map((exercise) => gym.map.get(exercise.exerciseId)?.name ?? "Exercise")
                    .join(", ")}
                </CardDescription>
              </CardHeader>
              {slot.status === "pending" ? (
                <CardFooter>
                  <Button className="w-full" onClick={() => start(slot.id)}>Start</Button>
                </CardFooter>
              ) : null}
            </Card>
          ))}
          <Button variant="link" render={<Link href="/train/shorten" />} nativeButton={false}>
            Fit into the days I have left
          </Button>
        </section>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No program yet</EmptyTitle>
            <EmptyDescription>Add a plan to start training.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/train/edit?new=1" />} nativeButton={false}>Add a plan</Button>
          </EmptyContent>
        </Empty>
      )}
      <AlertDialog open={choice != null} onOpenChange={(open) => { if (!open) setChoice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workout in progress</AlertDialogTitle>
            <AlertDialogDescription>
              {choice?.name} is already started. Resume it, or start again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const session = choice;
                setChoice(null);
                if (session) void restart(session);
              }}
            >
              Start again
            </Button>
            <Button
              type="button"
              onClick={() => {
                const session = choice;
                setChoice(null);
                if (session) openSession(session.id);
              }}
            >
              Resume
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Separator />
      <p className="text-xs text-muted-foreground">
        Exercise names from the exercises-dataset by Hasan Emir Yıldırım, MIT. Exercise demos © Gym visual —{" "}
        <a href="https://gymvisual.com/" className="underline" target="_blank" rel="noreferrer">
          gymvisual.com
        </a>
        .
      </p>
    </main>
  );
}
