"use client";

import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSnake, GRID, queueDir, step, TICK_MS, type Dir, type SnakeState } from "./rest-snake";

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RestOverlay({
  secondsLeft,
  caption,
  onBack,
  onSubtract,
  onAdd,
  onSkip,
}: {
  secondsLeft: number;
  caption: string;
  onBack: () => void;
  onSubtract: () => void;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const [state, setState] = useState<SnakeState>(createSnake);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const finalStretch = secondsLeft <= 10;

  useEffect(() => {
    if (!state.started || finalStretch) return;
    const timer = window.setInterval(() => {
      setState((current) => step(current));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.started, finalStretch]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const dir = KEY_DIR[event.key];
      if (!dir || finalStretch) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      setState((current) => queueDir(current, dir));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finalStretch]);

  function turn(dir: Dir) {
    if (finalStretch) return;
    setState((current) => queueDir(current, dir));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (finalStretch) return;
    swipe.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = swipe.current;
    swipe.current = null;
    if (!origin || finalStretch) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.hypot(dx, dy) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  const clock = formatClock(secondsLeft);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative shrink-0 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 text-white hover:bg-white/10 hover:text-white"
          aria-label="Back to workout"
          onClick={onBack}
        >
          <ChevronLeftIcon />
        </Button>
        <p
          role="timer"
          aria-label={`Rest ${clock}`}
          className={cn(
            "text-7xl font-semibold tabular-nums leading-none tracking-tight sm:text-8xl",
            finalStretch && "motion-safe:animate-pulse",
          )}
        >
          {clock}
        </p>
        <p className="mt-3 text-base text-white/80">{caption}</p>
      </div>
      <div
        className={cn("relative min-h-0 flex-1 touch-none", finalStretch && "opacity-40")}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        <div
          className="grid h-full w-full gap-px"
          style={{
            gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID}, minmax(0, 1fr))`,
          }}
          aria-hidden
        >
          {Array.from({ length: GRID * GRID }, (_, index) => {
            const x = index % GRID;
            const y = Math.floor(index / GRID);
            const snakeIndex = state.snake.findIndex((cell) => cell.x === x && cell.y === y);
            const food = state.food.x === x && state.food.y === y;
            return (
              <span
                key={`${x}-${y}`}
                className={cn(
                  snakeIndex === 0 && "bg-[#d8ffe8]",
                  snakeIndex > 0 && "bg-[#3dce73]",
                  food && "rounded-full bg-white",
                )}
              />
            );
          })}
        </div>
        {!state.started && !finalStretch ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white/80">
            Swipe to play
          </p>
        ) : null}
      </div>
      <div className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="pb-2 text-center text-sm tabular-nums text-white/70">
          {state.started ? `Length ${state.snake.length}` : "\u00a0"}
        </p>
        <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
          <Button type="button" variant="outline" className="h-12 text-base" onClick={onSubtract}>
            −15s
          </Button>
          <Button type="button" variant="ghost" className="h-12 text-base font-semibold text-white" onClick={onSkip}>
            Skip
          </Button>
          <Button type="button" variant="outline" className="h-12 text-base" onClick={onAdd}>
            +15s
          </Button>
        </div>
      </div>
    </div>
  );
}
