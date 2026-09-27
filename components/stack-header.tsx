"use client";

import { ChevronLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StackHeader({
  title,
  fallback,
  detail,
  children,
  below,
}: {
  title: React.ReactNode;
  fallback: string;
  detail?: string;
  children?: React.ReactNode;
  below?: React.ReactNode;
}) {
  const router = useRouter();

  function back() {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" ? idx > 0 : window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-1 px-2">
        <Button type="button" variant="ghost" size="icon" onClick={back} aria-label="Back">
          <ChevronLeftIcon />
        </Button>
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          {detail ? <p className="truncate text-sm text-muted-foreground tabular-nums">{detail}</p> : null}
        </div>
        {children}
      </div>
      {below}
    </header>
  );
}
