export function fromKg(kg: number, unit: "kg" | "lb") {
  return unit === "lb" ? kg * 2.2046226218 : kg;
}

export function toKg(value: number, unit: "kg" | "lb") {
  return unit === "lb" ? value / 2.2046226218 : value;
}

export function formatWeight(kg: number | null, unit: "kg" | "lb") {
  if (kg == null || !Number.isFinite(kg)) return "";
  const shown = Math.round(fromKg(kg, unit) * 10) / 10;
  return Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
}

export function formatLoad(kg: number, unit: "kg" | "lb") {
  const shown = fromKg(kg, unit);
  const rounded = unit === "lb" ? Math.round(shown) : Math.round(shown * 10) / 10;
  return `${rounded} ${unit}`;
}
