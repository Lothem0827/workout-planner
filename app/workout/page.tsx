import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StackHeader } from "@/components/stack-header";
import { WorkoutScreen } from "./screen";

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-background">
          <StackHeader title="Workout" fallback="/" />
          <div className="flex flex-col gap-4 px-4 py-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-48 w-full" />
          </div>
        </main>
      }
    >
      <WorkoutScreen />
    </Suspense>
  );
}
