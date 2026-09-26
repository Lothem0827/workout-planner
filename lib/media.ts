import paths from "@/data/exercise-media.json";

/** Commit of hasaneyldrm/exercises-dataset that exercise-media.json was built against. */
const DATASET_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";

const BASE = `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${DATASET_COMMIT}/`;

const media = paths as Record<string, string>;

export function catalogGifUrl(id: string | null | undefined) {
  if (!id) return null;
  const path = media[id];
  if (!path?.startsWith("videos/") || path.includes("..")) return null;
  return `${BASE}${path}`;
}
