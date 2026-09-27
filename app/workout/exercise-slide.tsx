"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  PlusIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  e1rm,
  lastLoggedExercise,
  restMs,
  restOptions,
  suggestedWeightKg,
  uid,
} from "@/lib/logic";
import { catalogGifUrl } from "@/lib/media";
import { demoUrlFor, youtubeEmbed } from "@/lib/minmax";
import { formatWeight, toKg } from "@/lib/units";
import { cn } from "@/lib/utils";
import type {
  LibraryExercise,
  Program,
  Session,
  SessionExercise,
} from "@/lib/types";

export type SubstitutionChoice = {
  key: string;
  option: string;
  lib: LibraryExercise;
  main: boolean;
};

export function substitutionChoices(
  exercise: SessionExercise,
  catalog: LibraryExercise[],
  map: Map<string, LibraryExercise>,
): SubstitutionChoice[] {
  const lib = map.get(exercise.exerciseId);
  const mainLib = exercise.swappedFromExerciseId
    ? map.get(exercise.swappedFromExerciseId)
    : lib;
  const choices: SubstitutionChoice[] = [
    exercise.substitution1,
    exercise.substitution2,
  ].flatMap((option, index) => {
    if (!option || option === "See Notes") return [];
    const match = catalog.find(
      (item) => item.name.toLowerCase() === option.toLowerCase(),
    );
    if (!match || match.id === exercise.exerciseId) return [];
    return [{ key: `sub-${index + 1}`, option, lib: match, main: false }];
  });
  if (mainLib && mainLib.id !== exercise.exerciseId) {
    choices.unshift({
      key: "main",
      option: mainLib.name,
      lib: mainLib,
      main: true,
    });
  }
  return choices;
}

export function ExerciseSlide({
  exercise,
  sessions,
  catalog,
  map,
  unit,
  builtin,
  segments,
  activeIndex,
  onJump,
  onOpenAlternatives,
  onPatch,
  onLoggedSet,
  skipRest,
  onSkipRest,
}: {
  exercise: SessionExercise;
  sessions: Session[];
  catalog: LibraryExercise[];
  map: Map<string, LibraryExercise>;
  unit: "kg" | "lb";
  builtin?: Program["builtin"];
  segments: { id: string; done: boolean }[];
  activeIndex: number;
  onJump: (index: number) => void;
  onOpenAlternatives: () => void;
  onPatch: (patch: (exercise: SessionExercise) => SessionExercise) => void;
  onLoggedSet: (durationMs: number) => void;
  skipRest: boolean;
  onSkipRest: (skip: boolean) => void;
}) {
  const lib = map.get(exercise.exerciseId);
  const name = lib?.name ?? "Exercise";
  const previous = lastLoggedExercise(exercise.exerciseId, sessions);
  const previousSets =
    previous?.sets.filter(
      (set) => set.done && set.weight != null && set.reps != null,
    ) ?? [];
  const suggestion = suggestedWeightKg(exercise, lib, sessions);
  const priorRir = (setIndex: number) =>
    setIndex === 0 ? previous?.rirSet1 : previous?.rirSet2;
  const nextRir = (() => {
    const first = exercise.rirSet1;
    const second = exercise.rirSet2;
    if (first && second && first !== second) return `${first} / ${second}`;
    return first || second || "";
  })();
  const nextReps =
    suggestion == null
      ? ""
      : suggestion.repMin === suggestion.repMax
        ? String(suggestion.repMin)
        : `${suggestion.repMin}–${suggestion.repMax}`;
  const embed = youtubeEmbed(demoUrlFor(name, builtin) ?? exercise.videoUrl);
  const gif = embed ? null : catalogGifUrl(lib?.id);
  const openSetId = exercise.sets.find((set) => !set.done)?.id ?? null;
  const alternatives = substitutionChoices(exercise, catalog, map);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [focusedSetId, setFocusedSetId] = useState<string | null>(null);
  const e1rmSet =
    exercise.sets.find((set) => set.id === focusedSetId) ??
    exercise.sets.find((set) => !set.done);
  const activeE1rm =
    e1rmSet?.weight != null && e1rmSet.reps != null
      ? formatWeight(e1rm(e1rmSet.weight, e1rmSet.reps), unit)
      : null;
  const repLabel = exercise.repRange || `${exercise.repMin}–${exercise.repMax}`;
  const fallbackRestMs = restMs(exercise.rest);

  return (
    <section
      aria-label={name}
      className="h-full min-h-0 min-w-0 snap-start snap-always touch-pan-y overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {embed ? (
        <div className="aspect-video overflow-hidden bg-black">
          <iframe
            className="h-full w-full"
            src={embed}
            title={`${name} demo`}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : gif ? (
        <div className="flex aspect-video items-center justify-center overflow-hidden bg-white">
          <Image
            src={gif}
            alt={`${name} demo`}
            width={180}
            height={180}
            unoptimized
            className="size-44 object-contain"
          />
        </div>
      ) : null}
      <div className="flex items-center gap-1 px-4 pt-3">
        {segments.map((segment, segmentIndex) => (
          <button
            key={segment.id}
            type="button"
            aria-label={`Exercise ${segmentIndex + 1}`}
            aria-current={segmentIndex === activeIndex ? "true" : undefined}
            className={cn(
              "flex-1 rounded-full",
              segmentIndex === activeIndex ? "h-2" : "h-1",
              segment.done
                ? "bg-recovery-fresh"
                : segmentIndex === activeIndex
                  ? "bg-white"
                  : "bg-muted",
            )}
            onClick={() => onJump(segmentIndex)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-xl font-semibold leading-tight">
            {name}
          </h2>
          <Button
            type="button"
            variant="outline"
            className="h-8 shrink-0 px-2.5"
            onClick={() => setRestOpen(true)}
          >
            <ClockIcon />
            <span className="font-medium tabular-nums">
              {exercise.rest?.trim() || "1:30"}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={alternatives.length ? "Substitutions" : "Swap"}
            onClick={onOpenAlternatives}
          >
            <ArrowLeftRightIcon />
          </Button>
        </div>
        {exercise.notes ? (
          <p className="text-sm text-foreground">{exercise.notes}</p>
        ) : null}
        <button
          type="button"
          className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
          aria-expanded={detailsOpen}
          aria-controls={`exercise-details-${exercise.id}`}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span>{detailsOpen ? "Hide details" : "Show details"}</span>
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              detailsOpen && "rotate-180",
            )}
          />
        </button>
        {detailsOpen ? (
          <div
            id={`exercise-details-${exercise.id}`}
            className="flex flex-col gap-1"
          >
            <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Last-set intensity</dt>
                <dd className="text-right text-foreground">
                  {exercise.technique || "N/A"}
                </dd>
              </div>
              {exercise.warmupSets ? (
                <div className="flex justify-between gap-3">
                  <dt>Warm-up sets</dt>
                  <dd className="text-foreground">{exercise.warmupSets}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt>Working sets</dt>
                <dd className="text-foreground">
                  {exercise.workingSets || exercise.setsTarget}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Rep range</dt>
                <dd className="text-foreground">{repLabel}</dd>
              </div>
              {exercise.rpe ? (
                <div className="flex justify-between gap-3">
                  <dt>RPE</dt>
                  <dd className="text-foreground">{exercise.rpe}</dd>
                </div>
              ) : null}
              {exercise.rirSet1 || exercise.rirSet2 ? (
                exercise.rirSet1 &&
                exercise.rirSet2 &&
                exercise.rirSet1 !== exercise.rirSet2 ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <dt>RIR set 1</dt>
                      <dd className="text-foreground">{exercise.rirSet1}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>RIR set 2</dt>
                      <dd className="text-foreground">{exercise.rirSet2}</dd>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between gap-3">
                    <dt>RIR</dt>
                    <dd className="text-foreground">
                      {exercise.rirSet1 || exercise.rirSet2}
                    </dd>
                  </div>
                )
              ) : null}
            </dl>
          </div>
        ) : null}
        {previousSets.length ? (
          <div className="-mx-4 flex flex-col bg-muted/25">
            <p className="px-4 py-2 text-base font-medium text-foreground tabular-nums">
              <span className="mr-2 text-sm font-normal text-muted-foreground">
                Previous
              </span>
              {previousSets.map((set, setIndex) => (
                <span key={set.id}>
                  {setIndex > 0 ? ", " : null}
                  {formatWeight(set.weight, unit)}
                  {" x "}
                  {set.reps}
                  {priorRir(setIndex) ? ` RIR ${priorRir(setIndex)}` : ""}
                  {setIndex === 0 && !priorRir(0) && previous?.rpe
                    ? ` RPE ${previous.rpe}`
                    : ""}
                </span>
              ))}
            </p>
            {suggestion != null ? (
              <p className="px-4 pb-2 text-base font-medium text-foreground tabular-nums">
                <span className="mr-2 text-sm font-normal text-muted-foreground">
                  Next
                </span>
                {formatWeight(suggestion.weight, unit)}
                {" x "}
                {nextReps}
                {nextRir ? ` RIR ${nextRir}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-[4.75rem_1fr_1fr_4.5rem] items-center text-sm text-muted-foreground">
          <span>Set</span>
          <span className="text-center">{unit === "kg" ? "Kg" : "Lb"}</span>
          <span className="text-center">Reps</span>
          {activeE1rm ? (
            <span className="justify-self-end whitespace-nowrap text-right tabular-nums">
              1RM{" "}
              <span className="font-medium text-primary">{activeE1rm}</span>
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {exercise.sets.map((set, setIndex) => {
            const current = set.id === focusedSetId;
            const perDb =
              set.id === openSetId && /dumbbell|^db$/i.test(lib?.equipment ?? "");
            const prior = previousSets[setIndex];
            const valueClass = cn(
              "w-full bg-transparent text-center text-2xl tabular-nums outline-none placeholder:text-muted-foreground",
              current
                ? "font-semibold text-primary underline decoration-primary underline-offset-4"
                : "text-muted-foreground",
            );
            return (
              <div
                key={set.id}
                className={cn(
                  "-mx-4 grid grid-cols-[4.75rem_1fr_1fr_4.5rem] items-center px-4 py-1.5",
                  current && "bg-muted/25",
                )}
                onClick={() => setFocusedSetId(set.id)}
              >
                <span
                  className={cn(
                    "text-lg",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {setIndex + 1}
                  {set.pr ? " PR" : ""}
                </span>
                <div className="flex flex-col items-center">
                  <input
                    inputMode="decimal"
                    aria-label={`Set ${setIndex + 1} load`}
                    placeholder={prior ? formatWeight(prior.weight, unit) : undefined}
                    value={formatWeight(set.weight, unit)}
                    onFocus={() => setFocusedSetId(set.id)}
                    onChange={(event) => {
                      setFocusedSetId(set.id);
                      const raw = event.target.value;
                      const weight =
                        raw === "" ? null : toKg(Number(raw), unit);
                      onPatch((item) => ({
                        ...item,
                        sets: item.sets.map((row) =>
                          row.id === set.id ? { ...row, weight } : row,
                        ),
                      }));
                    }}
                    className={valueClass}
                  />
                  {perDb ? (
                    <span className="text-xs text-muted-foreground">
                      Per DB
                    </span>
                  ) : null}
                </div>
                <input
                  inputMode="numeric"
                  aria-label={`Set ${setIndex + 1} reps`}
                  placeholder={prior ? String(prior.reps) : undefined}
                  value={set.reps ?? ""}
                  onFocus={() => setFocusedSetId(set.id)}
                  onChange={(event) => {
                    setFocusedSetId(set.id);
                    const reps =
                      event.target.value === ""
                        ? null
                        : Number(event.target.value);
                    onPatch((item) => ({
                      ...item,
                      sets: item.sets.map((row) =>
                        row.id === set.id ? { ...row, reps } : row,
                      ),
                    }));
                  }}
                  className={valueClass}
                />
                <button
                  type="button"
                  className={cn(
                    "justify-self-end",
                    set.done ? "text-recovery-fresh" : "text-muted-foreground",
                  )}
                  aria-label={set.done ? "Completed set" : "Complete set"}
                  onClick={() => {
                    const done = !set.done;
                    onPatch((item) => ({
                      ...item,
                      sets: item.sets.map((row) =>
                        row.id === set.id ? { ...row, done } : row,
                      ),
                    }));
                    if (done) onLoggedSet(set.restMs ?? fallbackRestMs);
                  }}
                >
                  <CheckIcon className="size-5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[4.75rem_1fr_1fr_4.5rem] items-center text-muted-foreground">
          <button
            type="button"
            aria-label="Add set"
            className="flex justify-center"
            onClick={() => {
              const last = exercise.sets.at(-1);
              onPatch((item) => ({
                ...item,
                sets: [
                  ...item.sets,
                  {
                    id: uid(),
                    weight: suggestion?.weight ?? last?.weight ?? null,
                    reps: last?.reps ?? null,
                    done: false,
                  },
                ],
              }));
            }}
          >
            <PlusIcon className="size-5" />
          </button>
          <span className="text-center text-2xl opacity-40">
            {formatWeight(
              suggestion?.weight ?? exercise.sets.at(-1)?.weight ?? null,
              unit,
            )}
          </span>
          <span className="text-center text-2xl opacity-40">
            {exercise.sets.at(-1)?.reps ?? ""}
          </span>
          <button
            type="button"
            className="justify-self-end text-sm disabled:opacity-40"
            disabled={
              exercise.sets.length <= exercise.setsTarget ||
              Boolean(exercise.sets.at(-1)?.done)
            }
            onClick={() => {
              onPatch((item) => ({ ...item, sets: item.sets.slice(0, -1) }));
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {restOpen ? (
        <RestTimerSheet
          name={name}
          sets={exercise.sets}
          fallbackMs={fallbackRestMs}
          skipped={skipRest}
          onClose={() => setRestOpen(false)}
          onChange={(setId, durationMs) => {
            onPatch((item) => ({
              ...item,
              sets: item.sets.map((row) =>
                row.id === setId ? { ...row, restMs: durationMs } : row,
              ),
            }));
          }}
          onSkip={onSkipRest}
        />
      ) : null}
    </section>
  );
}

export function RestTimerSheet({
  name,
  sets,
  fallbackMs,
  skipped,
  onClose,
  onChange,
  onSkip,
}: {
  name: string;
  sets: SessionExercise["sets"];
  fallbackMs: number;
  skipped: boolean;
  onClose: () => void;
  onChange: (setId: string, durationMs: number) => void;
  onSkip: (skip: boolean) => void;
}) {
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showSwipeHandle
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Rest timer</DrawerTitle>
          <DrawerDescription>{name}</DrawerDescription>
        </DrawerHeader>
        <ul className="flex max-h-[70dvh] flex-col gap-2 overflow-auto px-4 pt-4">
          {sets.map((set, index) => {
            const durationMs = set.restMs ?? fallbackMs;
            const options = restOptions(durationMs);
            return (
              <li key={set.id} className="flex items-center gap-3">
                <span className="w-4 text-sm text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <Select
                  items={options}
                  value={String(durationMs)}
                  onValueChange={(value) => {
                    if (value) onChange(set.id, Number(value));
                  }}
                >
                  <SelectTrigger
                    className="w-full tabular-nums"
                    aria-label={`Set ${index + 1} rest`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="link"
            className="w-full"
            onClick={() => onSkip(!skipped)}
          >
            {skipped
              ? "Use rest timer for this workout"
              : "Skip rest timer for this workout"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function SubstitutionSheet({
  name,
  choices,
  onClose,
  onPick,
}: {
  name: string;
  choices: SubstitutionChoice[];
  onClose: () => void;
  onPick: (exercise: LibraryExercise) => void;
}) {
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Substitutions</DrawerTitle>
          <DrawerDescription>{name}</DrawerDescription>
        </DrawerHeader>
        <ul className="flex max-h-[70dvh] flex-col gap-2 overflow-auto p-4">
          {choices.map((choice) => (
            <li key={choice.key}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full justify-between px-3"
                onClick={() => onPick(choice.lib)}
              >
                <span className="flex min-w-0 items-center gap-2 text-left">
                  <span className="truncate">{choice.option}</span>
                  {choice.main ? <Badge variant="secondary">Main</Badge> : null}
                </span>
                <ArrowLeftRightIcon data-icon="inline-end" />
              </Button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
