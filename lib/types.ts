export type Muscle =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "abs"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "lats"
  | "traps"
  | "lowerBack";

export type Pattern =
  | "horizontalPress"
  | "fly"
  | "verticalPress"
  | "horizontalPull"
  | "verticalPull"
  | "squat"
  | "hinge"
  | "lunge"
  | "curl"
  | "extension"
  | "raise"
  | "calfRaise"
  | "core"
  | "other";

export type RecoveryState = "fresh" | "recovering" | "fatigued";

export interface LibraryExercise {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  equipment: string;
  pattern: Pattern;
  custom?: boolean;
}

export interface Prescription {
  technique?: string;
  warmupSets?: string;
  workingSets?: string;
  repRange?: string;
  rirSet1?: string;
  rirSet2?: string;
  rpe?: string;
  rest?: string;
  substitution1?: string;
  substitution2?: string;
  notes?: string;
  videoUrl?: string | null;
}

export interface PlannedExercise extends Prescription {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface ProgramDay {
  id: string;
  name: string;
  exercises: PlannedExercise[];
}

export interface ProgramWeek {
  week: number;
  days: ProgramDay[];
}

export interface Program {
  id: string;
  name: string;
  days: ProgramDay[];
  weeks?: ProgramWeek[];
  weekIndex?: number;
  builtin?: "minmax" | "upper-lower";
}

export interface WeekSlot {
  id: string;
  sourceDayId: string;
  name: string;
  exercises: PlannedExercise[];
  status: "pending" | "done" | "dropped";
  sessionId?: string;
}

export interface WeekPlan {
  id: string;
  programId: string;
  pass: number;
  slots: WeekSlot[];
}

export interface SetLog {
  id: string;
  weight: number | null;
  reps: number | null;
  done: boolean;
  pr?: boolean;
  restMs?: number;
}

export interface SessionExercise extends Prescription {
  id: string;
  exerciseId: string;
  swappedFromExerciseId?: string;
  setsTarget: number;
  repMin: number;
  repMax: number;
  sets: SetLog[];
}

export interface Session {
  id: string;
  date: string;
  name: string;
  slotId?: string;
  weekIndex?: number;
  status: "active" | "finished";
  startedAt: number;
  finishedAt?: number;
  skipRest?: boolean;
  exercises: SessionExercise[];
}

export interface Settings {
  id: "settings";
  unit: "kg" | "lb";
  activeProgramId?: string;
  ongoingProgramId?: string;
}

export const MUSCLES: Muscle[] = [
  "chest",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "lats",
  "traps",
  "lowerBack",
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  abs: "Abs",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  lats: "Lats",
  traps: "Traps",
  lowerBack: "Lower back",
};

export const PATTERNS: Pattern[] = [
  "horizontalPress",
  "fly",
  "verticalPress",
  "horizontalPull",
  "verticalPull",
  "squat",
  "hinge",
  "lunge",
  "curl",
  "extension",
  "raise",
  "calfRaise",
  "core",
  "other",
];

export const PATTERN_LABEL: Record<Pattern, string> = {
  horizontalPress: "Horizontal press",
  fly: "Fly",
  verticalPress: "Vertical press",
  horizontalPull: "Horizontal pull",
  verticalPull: "Vertical pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  curl: "Curl",
  extension: "Extension",
  raise: "Raise",
  calfRaise: "Calf raise",
  core: "Core",
  other: "Other",
};

export const LOWER: Muscle[] = ["quads", "hamstrings", "glutes", "calves"];
