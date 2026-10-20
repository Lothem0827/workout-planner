"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";

export default function TrainPage() {
  const gym = useGym();

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
          <Link key={plan.id} href={`/workout?plan=${plan.id}`} className="block rounded-xl">
            <Card>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                {plan.weeks?.length ? (
                  <CardDescription>
                    Week {plan.weekIndex ?? 1} of {plan.weeks.length}
                  </CardDescription>
                ) : null}
              </CardHeader>
            </Card>
          </Link>
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
    </main>
  );
}
