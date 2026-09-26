"use client";

import Image from "next/image";
import { ArrowLeftRightIcon, CheckIcon, ClockIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { lastLoggedExercise, suggestedWeightKg, uid } from "@/lib/logic";
import { catalogGifUrl } from "@/lib/media";
import { demoUrlFor, youtubeEmbed } from "@/lib/minmax";
import { formatWeight, toKg } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { LibraryExercise, Program, Session, SessionExercise } from "@/lib/types";

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
  const mainLib = exercise.swappedFromExerciseId ? map.get(exercise.swappedFromExerciseId) : lib;
  const choices: SubstitutionChoice[] = [exercise.substitution1, exercise.substitution2].flatMap(
    (option, index) => {
      if (!option || option === "See Notes") return [];
      const match = catalog.find((item) => item.name.toLowerCase() === option.toLowerCase());
      if (!match || match.id === exercise.exerciseId) return [];
      return [{ key: `sub-${index + 1}`, option, lib: match, main: false }];
    },
  );
  if (mainLib && mainLib.id !== exercise.exerciseId) {
    choices.unshift({ key: "main", option: mainLib.name, lib: mainLib, main: true });
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
  weekIndex,
  segments,
  activeIndex,
  onJump,
  onOpenAlternatives,
  onPatch,
  onLoggedSet,
}: {
  exercise: SessionExercise;
  sessions: Session[];
  catalog: LibraryExercise[];
  map: Map<string, LibraryExercise>;
  unit: "kg" | "lb";
  builtin?: Program["builtin"];
  weekIndex?: number;
  segments: { id: string; done: boolean }[];
  activeIndex: number;
  onJump: (index: number) => void;
  onOpenAlternatives: () => void;
  onPatch: (patch: (exercise: SessionExercise) => SessionExercise) => void;
  onLoggedSet: () => void;
}) {
  const lib = map.get(exercise.exerciseId);
  const name = lib?.name ?? "Exercise";
  const previous = lastLoggedExercise(exercise.exerciseId, sessions);
  const previousSets =
    previous?.sets.filter((set) => set.done && set.weight != null && set.reps != null) ?? [];
  const suggestion = suggestedWeightKg(exercise, lib, sessions);
  const rirFor = (setIndex: number) => (setIndex === 0 ? exercise.rirSet1 : exercise.rirSet2);
  const priorRir = (setIndex: number) => (setIndex === 0 ? previous?.rirSet1 : previous?.rirSet2);
  const embed = youtubeEmbed(demoUrlFor(name, builtin) ?? exercise.videoUrl);
  const gif = embed ? null : catalogGifUrl(lib?.id);
  const openSetId = exercise.sets.find((set) => !set.done)?.id ?? null;
  const alternatives = substitutionChoices(exercise, catalog, map);

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
      <div className="flex gap-1 px-4 pt-3">
        {segments.map((segment, segmentIndex) => (
          <button
            key={segment.id}
            type="button"
            aria-label={`Exercise ${segmentIndex + 1}`}
            aria-current={segmentIndex === activeIndex ? "true" : undefined}
            className={cn(
              "h-1 flex-1 rounded-full",
              segmentIndex === activeIndex || segment.done ? "bg-primary" : "bg-muted",
            )}
            onClick={() => onJump(segmentIndex)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        {weekIndex ? <p className="text-xs text-muted-foreground">Week {weekIndex}</p> : null}
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-xl font-semibold leading-tight">{name}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={alternatives.length ? "Substitutions" : "Swap"}
            onClick={onOpenAlternatives}
          >
            <ArrowLeftRightIcon />
          </Button>
        </div>
        {exercise.notes ? <p className="text-sm text-foreground">{exercise.notes}</p> : null}
        <div className="flex w-fit items-center gap-1.5 rounded-lg border px-3 py-2 text-sm">
          <ClockIcon className="size-3.5" />
          <span>Rest</span>
          <span className="font-medium tabular-nums">{exercise.rest?.trim() || "1:30"}</span>
        </div>
        <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>Last-set intensity</dt>
            <dd className="text-right text-foreground">{exercise.technique || "N/A"}</dd>
          </div>
          {exercise.warmupSets ? (
            <div className="flex justify-between gap-3">
              <dt>Warm-up sets</dt>
              <dd className="text-foreground">{exercise.warmupSets}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt>Working sets</dt>
            <dd className="text-foreground">{exercise.workingSets || exercise.setsTarget}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Rep range</dt>
            <dd className="text-foreground">
              {exercise.repRange || `${exercise.repMin}–${exercise.repMax}`}
            </dd>
          </div>
          {exercise.rpe ? (
            <div className="flex justify-between gap-3">
              <dt>RPE</dt>
              <dd className="text-foreground">{exercise.rpe}</dd>
            </div>
          ) : null}
        </dl>
        {previousSets.length ? (
          <p className="text-sm text-muted-foreground">
            Previous{" "}
            {previousSets
              .map(
                (set, setIndex) =>
                  `${formatWeight(set.weight, unit)}×${set.reps}${priorRir(setIndex) ? ` RIR ${priorRir(setIndex)}` : ""}${setIndex === 0 && !priorRir(0) && previous?.rpe ? ` RPE ${previous.rpe}` : ""}`,
              )
              .join(", ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Previous —</p>
        )}
        {suggestion != null ? (
          <p className="text-sm text-muted-foreground">
            Next {formatWeight(suggestion.weight, unit)} {unit}
          </p>
        ) : null}
        <div className="grid grid-cols-[4.75rem_1fr_1fr_4.5rem] items-center text-sm text-muted-foreground">
          <span>Set</span>
          <span className="text-center">{unit === "kg" ? "Kg" : "Lb"}</span>
          <span className="text-center">Reps</span>
          <span />
        </div>
        {exercise.sets.map((set, setIndex) => {
          const current = set.id === openSetId;
          const perDb = current && /dumbbell|^db$/i.test(lib?.equipment ?? "");
          const valueClass = cn(
            "w-full bg-transparent text-center text-2xl tabular-nums outline-none",
            current
              ? "font-semibold text-primary underline decoration-primary underline-offset-4"
              : "text-muted-foreground",
          );
          return (
            <div
              key={set.id}
              className="grid grid-cols-[4.75rem_1fr_1fr_4.5rem] items-center py-1"
            >
              <span className={cn("text-lg", current ? "text-foreground" : "text-muted-foreground")}>
                {setIndex + 1}
                {set.pr ? " PR" : ""}
                {rirFor(setIndex) ? (
                  <span className="block whitespace-nowrap text-xs text-muted-foreground">RIR {rirFor(setIndex)}</span>
                ) : exercise.rpe ? (
                  <span className="block whitespace-nowrap text-xs text-muted-foreground">RPE {exercise.rpe}</span>
                ) : null}
              </span>
              <div className="flex flex-col items-center">
                <input
                  inputMode="decimal"
                  aria-label={`Set ${setIndex + 1} load`}
                  value={formatWeight(set.weight, unit)}
                  onChange={(event) => {
                    const raw = event.target.value;
                    const weight = raw === "" ? null : toKg(Number(raw), unit);
                    onPatch((item) => ({
                      ...item,
                      sets: item.sets.map((row) => (row.id === set.id ? { ...row, weight } : row)),
                    }));
                  }}
                  className={valueClass}
                />
                {perDb ? <span className="text-xs text-muted-foreground">Per DB</span> : null}
              </div>
              <input
                inputMode="numeric"
                aria-label={`Set ${setIndex + 1} reps`}
                value={set.reps ?? ""}
                onChange={(event) => {
                  const reps = event.target.value === "" ? null : Number(event.target.value);
                  onPatch((item) => ({
                    ...item,
                    sets: item.sets.map((row) => (row.id === set.id ? { ...row, reps } : row)),
                  }));
                }}
                className={valueClass}
              />
              <button
                type="button"
                className="justify-self-end text-muted-foreground"
                aria-label={set.done ? "Completed set" : "Complete set"}
                onClick={() => {
                  const done = !set.done;
                  onPatch((item) => ({
                    ...item,
                    sets: item.sets.map((row) => (row.id === set.id ? { ...row, done } : row)),
                  }));
                  if (done) onLoggedSet();
                }}
              >
                <CheckIcon className="size-5" />
              </button>
            </div>
          );
        })}
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
            {formatWeight(suggestion?.weight ?? exercise.sets.at(-1)?.weight ?? null, unit)}
          </span>
          <span className="text-center text-2xl opacity-40">{exercise.sets.at(-1)?.reps ?? ""}</span>
          <button
            type="button"
            className="justify-self-end text-sm disabled:opacity-40"
            disabled={exercise.sets.length <= exercise.setsTarget || Boolean(exercise.sets.at(-1)?.done)}
            onClick={() => {
              onPatch((item) => ({ ...item, sets: item.sets.slice(0, -1) }));
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </section>
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
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
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
