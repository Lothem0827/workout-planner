"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BodyMap } from "@/components/body-map";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGym } from "@/lib/gym";
import {
  activeSessionForSlot,
  fatigueScore,
  formatDate,
  lastTrained,
  pickToday,
  readyInHours,
  recoveryState,
  scoreForSlot,
  todayKey,
} from "@/lib/logic";
import { MUSCLE_LABEL, MUSCLES, type Muscle, type RecoveryState, type Session } from "@/lib/types";

export default function HomePage() {
  const gym = useGym();
  const router = useRouter();
  const [side, setSide] = useState<"front" | "back">("front");
  const [picked, setPicked] = useState<Muscle | null>(null);
  const [others, setOthers] = useState(false);
  const [choice, setChoice] = useState<Session | null>(null);

  const states = useMemo(() => {
    const next = {} as Record<Muscle, RecoveryState>;
    for (const muscle of MUSCLES) {
      next[muscle] = recoveryState(fatigueScore(muscle, gym.sessions, gym.map));
    }
    return next;
  }, [gym.sessions, gym.map]);

  const today = pickToday(gym.week, gym.map, gym.sessions);
  const pending = gym.week?.slots.filter((slot) => slot.status === "pending") ?? [];
  const todayInProgress = today ? activeSessionForSlot(today.slot.id, gym.sessions) : null;
  const index = today
    ? (gym.week?.slots.filter((slot) => slot.status !== "dropped").findIndex((slot) => slot.id === today.slot.id) ?? 0) + 1
    : 0;
  const total = gym.week?.slots.filter((slot) => slot.status !== "dropped").length ?? 0;

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
      setOthers(false);
      setChoice(existing);
      return;
    }
    void begin(slotId);
  }

  if (!gym.ready) {
    return (
      <main className="flex flex-col gap-4 px-4 py-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 py-5">
      <p className="text-2xl font-semibold">{formatDate(todayKey())}</p>
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
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-recovery-fresh" />Fresh</span>
            <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-recovery-recovering" />Recovering</span>
            <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-recovery-fatigued" />Fatigued</span>
          </div>
        </CardContent>
      </Card>

      {picked ? (
        <MuscleSheet
          muscle={picked}
          sessions={gym.sessions}
          map={gym.map}
          onClose={() => setPicked(null)}
        />
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
      ) : today ? (
        <Card>
          <CardHeader>
            <CardDescription>
              {gym.program.weeks?.length ? `Week ${gym.program.weekIndex ?? 1} of ${gym.program.weeks.length} · ` : ""}
              {today.slot.name} · Day {index} of {total}
            </CardDescription>
            {today.notRecommended ? <Badge variant="destructive">Not recommended</Badge> : null}
            <CardDescription>{today.slot.exercises.length} exercises</CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-stretch gap-3">
            {todayInProgress ? (
              <>
                <Button className="w-full" onClick={() => openSession(todayInProgress.id)}>
                  Resume
                </Button>
                <Button className="w-full" variant="outline" onClick={() => void restart(todayInProgress)}>
                  Start again
                </Button>
              </>
            ) : (
              <Button className="w-full" onClick={() => void begin(today.slot.id)}>
                Start
              </Button>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="link" onClick={() => setOthers(true)}>
                Do another day
              </Button>
              {pending.length > 0 ? (
                <Button variant="link" render={<Link href="/train/shorten" />} nativeButton={false}>
                  Fit into the days I have left
                </Button>
              ) : null}
            </div>
          </CardFooter>
        </Card>
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

      <Drawer open={others} onOpenChange={setOthers}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Unfinished days</DrawerTitle>
            <DrawerDescription>Start a different day from this pass.</DrawerDescription>
          </DrawerHeader>
          <div className="flex max-h-[70dvh] flex-col gap-2 overflow-auto p-4">
            {pending.map((slot) => {
              const score = scoreForSlot(slot, gym.map, gym.sessions);
              return (
                <Button
                  key={slot.id}
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between"
                  onClick={() => start(slot.id)}
                >
                  <span>{slot.name}</span>
                  {score.notRecommended ? (
                    <Badge variant="destructive">Not recommended</Badge>
                  ) : (
                    <Badge>Ready</Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

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
    </main>
  );
}

function MuscleSheet({
  muscle,
  sessions,
  map,
  onClose,
}: {
  muscle: Muscle;
  sessions: ReturnType<typeof useGym>["sessions"];
  map: ReturnType<typeof useGym>["map"];
  onClose: () => void;
}) {
  const score = fatigueScore(muscle, sessions, map);
  const hours = readyInHours(muscle, score);
  const last = lastTrained(muscle, sessions, map);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{MUSCLE_LABEL[muscle]}</CardTitle>
        <CardDescription className="capitalize">{recoveryState(score)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p>{last ? `Last trained ${new Date(last).toLocaleDateString()}` : "Not trained yet"}</p>
        <p className="text-muted-foreground">
          {hours <= 0 ? "Ready now" : `Ready in about ${Math.ceil(hours)} hours`}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </CardFooter>
    </Card>
  );
}
