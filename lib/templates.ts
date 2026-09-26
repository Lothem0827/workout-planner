import type { LibraryExercise, Program, ProgramDay } from "./types";
import { uid } from "./logic";

const TEMPLATES: { id: string; label: string; days: { name: string; ids: string[] }[] }[] = [
  {
    id: "full",
    label: "Full body (3)",
    days: [
      { name: "Full body A", ids: ["0026", "0025", "0027"] },
      { name: "Full body B", ids: ["0032", "0047", "0652"] },
      { name: "Full body C", ids: ["0085", "0405", "0031"] },
    ],
  },
  {
    id: "ppl",
    label: "Push / pull / legs (6)",
    days: [
      { name: "Push", ids: ["0025", "0405", "0188", "0334"] },
      { name: "Pull", ids: ["0027", "0652", "0031"] },
      { name: "Legs", ids: ["0026", "0085", "0599", "1372"] },
      { name: "Push 2", ids: ["0047", "0091", "0308"] },
      { name: "Pull 2", ids: ["0027", "0652", "0294"] },
      { name: "Legs 2", ids: ["0032", "0585", "1409", "1372"] },
    ],
  },
];

function dayFrom(name: string, ids: string[], catalog: LibraryExercise[]): ProgramDay {
  return {
    id: uid(),
    name,
    exercises: ids
      .filter((id) => catalog.some((exercise) => exercise.id === id))
      .map((id) => ({
        id: uid(),
        exerciseId: id,
        sets: 3,
        repMin: 6,
        repMax: 10,
      })),
  };
}

export function templateProgram(kind: string, catalog: LibraryExercise[]): Program | null {
  const template = TEMPLATES.find((item) => item.id === kind);
  if (!template) return null;
  return {
    id: uid(),
    name: template.label.replace(/ \(.*\)/, ""),
    days: template.days.map((day) => dayFrom(day.name, day.ids, catalog)),
  };
}

export function blankProgram(dayCount: number): Program {
  return {
    id: uid(),
    name: "My program",
    days: Array.from({ length: dayCount }, (_, index) => ({
      id: uid(),
      name: `Day ${index + 1}`,
      exercises: [],
    })),
  };
}

export const TEMPLATE_OPTIONS = TEMPLATES.map(({ id, label }) => ({ id, label }));
