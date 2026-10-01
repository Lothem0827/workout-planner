"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGym } from "@/lib/gym";
import { currentExerciseIndex } from "@/lib/logic";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

export const ACTIVE_BAR_HEIGHT = "4.75rem";

export function useActiveSession(): Session | null {
  const gym = useGym();
  if (!gym.ready) return null;
  return (
    gym.sessions
      .filter((session) => session.status === "active")
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function ActiveWorkoutBar({
  session,
  root,
}: {
  session: Session;
  root: boolean;
}) {
  const gym = useGym();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const exercise = session.exercises[currentExerciseIndex(session)];
  const name = exercise ? (gym.map.get(exercise.exerciseId)?.name ?? "Exercise") : session.name;
  const href = `/workout?session=${session.id}`;

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 px-3",
        root ? "bottom-[calc(env(safe-area-inset-bottom)+2.75rem)]" : "bottom-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="mx-auto mb-2 flex max-w-md items-center gap-3 rounded-2xl border bg-card p-2 pl-4 text-card-foreground shadow-lg">
        <Link href={href} className="min-w-0 flex-1 py-1" aria-label={`Return to ${session.name}`}>
          <p className="text-sm font-semibold tabular-nums text-primary">{formatElapsed(seconds)}</p>
          <p className="truncate text-sm font-semibold">{name}</p>
        </Link>
        <Button
          type="button"
          className="h-10 shrink-0"
          onClick={() => router.push(`${href}&finish=1`)}
        >
          End Workout
        </Button>
      </div>
    </div>
  );
}
