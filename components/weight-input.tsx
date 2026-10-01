"use client";

import { useState, type ComponentProps, type ElementType } from "react";
import { formatWeight, toKg } from "@/lib/units";

type WeightInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur" | "inputMode"> & {
  kg: number | null;
  unit: "kg" | "lb";
  onWeight: (kg: number | null) => void;
  as?: ElementType;
};

const PARTIAL_NUMBER = /^\d*[.,]?\d*$/;

export function WeightInput({ kg, unit, onWeight, as: Field = "input", ...props }: WeightInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Field
      {...props}
      inputMode="decimal"
      value={draft ?? formatWeight(kg, unit)}
      onChange={(event: { target: { value: string } }) => {
        const raw = event.target.value;
        if (!PARTIAL_NUMBER.test(raw)) return;
        setDraft(raw);
        if (raw === "") {
          onWeight(null);
          return;
        }
        const value = Number(raw.replace(",", "."));
        if (Number.isFinite(value)) onWeight(toKg(value, unit));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
