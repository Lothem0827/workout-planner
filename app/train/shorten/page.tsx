"use client";

import { useMemo, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { StackHeader } from "@/components/stack-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGym } from "@/lib/gym";
import { foldWeek } from "@/lib/logic";

export default function ShortenPage() {
  const gym = useGym();
  const router = useRouter();
  const pending = gym.week?.slots.filter((slot) => slot.status === "pending").length ?? 0;
  const [remaining, setRemaining] = useState(Math.max(1, pending - 1));

  const preview = useMemo(() => {
    if (!gym.week || !gym.program) return null;
    return foldWeek(gym.week, gym.program, gym.sessions, gym.map, remaining);
  }, [gym.week, gym.program, gym.sessions, gym.map, remaining]);

  if (!gym.ready) {
    return (
      <main>
        <StackHeader title="Days left" fallback="/" />
        <div className="px-4 py-4">
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }
  if (!gym.week || !preview) {
    return (
      <main>
        <StackHeader title="Days left" fallback="/" />
        <div className="px-4 py-4">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No program yet</EmptyTitle>
              <EmptyDescription>Build a program first.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    );
  }

  return (
    <main>
      <StackHeader title="Days left" fallback="/" />
      <div className="flex flex-col gap-4 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          How many sessions can you still train this pass? Your saved program stays the same.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Sessions left</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Fewer sessions"
                onClick={() => setRemaining((value) => Math.max(1, value - 1))}
              >
                <MinusIcon />
              </Button>
              <span className="tabular-nums">{remaining}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="More sessions"
                onClick={() => setRemaining((value) => Math.min(pending, value + 1))}
              >
                <PlusIcon />
              </Button>
            </div>
          </CardHeader>
        </Card>
        {preview.droppedNames.length ? (
          <p className="text-sm text-muted-foreground">Folding {preview.droppedNames.join(", ")}</p>
        ) : null}
        {preview.rows.map((row) => (
          <Card key={row.name}>
            <CardHeader>
              <CardTitle>{row.name}</CardTitle>
              <CardDescription>Kept: {row.kept.join(", ") || "None"}</CardDescription>
              {row.added.length ? <p className="text-primary">Added: {row.added.join(", ")}</p> : null}
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Muscle count</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {preview.counts.map((item) => (
                <Badge key={item.muscle} variant={item.count >= item.floor ? "default" : "destructive"}>
                  {item.label} {item.count} / {item.floor}
                </Badge>
              ))}
            </div>
            {preview.gaps.length ? (
              <p className="text-sm text-muted-foreground">
                Still short: {preview.gaps.join(", ")}. Add one exercise on a remaining day if you want that second hit.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Button
          type="button"
          className="w-full"
          onClick={async () => {
            if (!gym.week) return;
            await gym.saveWeek({ ...gym.week, slots: preview.slots });
            router.push("/");
          }}
        >
          Use this week
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => router.back()}>
          Keep my plan
        </Button>
      </div>
    </main>
  );
}
