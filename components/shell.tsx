"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACTIVE_BAR_HEIGHT, ActiveWorkoutBar, useActiveSession } from "@/components/active-workout-bar";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/train", label: "Workouts" },
  { href: "/progress", label: "Progress" },
];

const ROOTS = new Set(["/", "/train", "/progress"]);

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const root = ROOTS.has(pathname);
  const session = useActiveSession();
  const showBar = Boolean(session) && !pathname.startsWith("/workout");
  const pageClass = root
    ? showBar
      ? "pb-[calc(6rem+var(--active-bar-height))] pt-[env(safe-area-inset-top)]"
      : "pb-24 pt-[env(safe-area-inset-top)]"
    : showBar
      ? "pb-[calc(env(safe-area-inset-bottom)+var(--active-bar-height))]"
      : "pb-[env(safe-area-inset-bottom)]";

  return (
    <div
      className="mx-auto min-h-dvh w-full max-w-md bg-background"
      style={{ "--active-bar-height": showBar ? ACTIVE_BAR_HEIGHT : "0px" } as CSSProperties}
    >
      <div className={pageClass}>{children}</div>
      {session && showBar ? <ActiveWorkoutBar session={session} root={root} /> : null}
      {root ? <TabBar pathname={pathname} /> : null}
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "py-3 text-center text-sm",
                active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
