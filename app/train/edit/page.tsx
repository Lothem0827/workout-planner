import { Suspense } from "react";
import { ProgramEditor } from "./editor";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditProgramPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col gap-4 px-4 py-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      }
    >
      <ProgramEditor />
    </Suspense>
  );
}
