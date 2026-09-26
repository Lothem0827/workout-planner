/**
 * Join catalog exercise ids to gif_url paths from
 * https://github.com/hasaneyldrm/exercises-dataset
 * and write data/exercise-media.json.
 *
 * Does not download GIF binaries. The app loads each file from jsDelivr
 * at the commit printed below.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = "hasaneyldrm/exercises-dataset";

const commitRes = await fetch(`https://api.github.com/repos/${repo}/commits/main`, {
  headers: { Accept: "application/vnd.github+json", "User-Agent": "workout-tracker" },
});
if (!commitRes.ok) throw new Error(`Commit lookup failed: ${commitRes.status}`);
const commit = (await commitRes.json()).sha;
if (!commit) throw new Error("Missing commit sha");

const exercisesRes = await fetch(
  `https://raw.githubusercontent.com/${repo}/${commit}/data/exercises.json`,
);
if (!exercisesRes.ok) throw new Error(`Dataset download failed: ${exercisesRes.status}`);

const catalog = JSON.parse(await readFile(join(root, "data/catalog.json"), "utf8"));
const exercises = await exercisesRes.json();
const byId = new Map(exercises.map((exercise) => [exercise.id, exercise.gif_url]));
const media = {};
const missing = [];
for (const exercise of catalog) {
  const gif = byId.get(exercise.id);
  if (!gif) {
    missing.push(exercise.id);
    continue;
  }
  media[exercise.id] = gif;
}

await writeFile(join(root, "data/exercise-media.json"), `${JSON.stringify(media, null, 2)}\n`);
console.log(`commit ${commit}`);
console.log(`mapped ${Object.keys(media).length} of ${catalog.length}`);
if (missing.length) console.log(`missing ${missing.join(", ")}`);
