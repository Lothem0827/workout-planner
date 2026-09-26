"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";

export default function TrainPage() {
  const gym = useGym();
  const router = useRouter();
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const [dialogNames, setDialogNames] = useState({ current: "This workout", next: "this workout" });
  const ongoing = gym.programs.find((plan) => plan.id === gym.settings.ongoingProgramId) ?? null;

  async function open(id: string) {
    await gym.beginProgram(id);
    router.push(`/workout?plan=${id}`);
  }

  function press(id: string) {
    if (id === ongoing?.id) {
      void open(id);
      return;
    }
    if (ongoing) {
      const next = gym.programs.find((plan) => plan.id === id);
      setDialogNames({ current: ongoing.name, next: next?.name ?? "this workout" });
      setSwitchTo(id);
      return;
    }
    void open(id);
  }

  if (!gym.ready) {
    return (
      <main className="flex flex-col gap-4 px-4 py-5">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Workouts</h1>
        <Button className="shrink-0" variant="ghost" render={<Link href="/train/edit?new=1" />} nativeButton={false}>
          Add a plan
          <PlusIcon data-icon="inline-end" />
        </Button>
      </div>
      {gym.programs.length ? (
        gym.programs.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              {plan.weeks?.length ? (
                <CardDescription>
                  Week {plan.weekIndex ?? 1} of {plan.weeks.length}
                </CardDescription>
              ) : null}
              <CardAction>
                <Button type="button" onClick={() => press(plan.id)}>
                  {plan.id === ongoing?.id ? "Resume" : "Start"}
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        ))
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
      <AlertDialog open={switchTo != null} onOpenChange={(open) => { if (!open) setSwitchTo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ongoing workout</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogNames.current} is already started. Start {dialogNames.next} instead? You can always come back to {dialogNames.current}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                const id = switchTo;
                setSwitchTo(null);
                if (id) void open(id);
              }}
            >
              Start
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
