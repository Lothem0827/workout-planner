"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MonthCalendar({
  trained,
  cursor,
  onCursor,
}: {
  trained: Set<string>;
  cursor: Date;
  onCursor: (next: Date) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const label = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeftIcon />
          </Button>
          <CardTitle>{label}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="py-1">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center">
          {cells.map((day, index) => {
            if (!day) return <div key={`e-${index}`} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hit = trained.has(key);
            const className = cn(
              "mx-auto my-1 flex size-9 items-center justify-center rounded-full text-sm tabular-nums",
              hit ? "bg-primary font-semibold text-primary-foreground" : "text-foreground",
            );
            return hit ? (
              <Link key={key} href={`/log/${key}`} className={className}>{day}</Link>
            ) : (
              <div key={key} className={className}>{day}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
