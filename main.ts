// Starfall — "Day one, day seven" entry for the make.fun bounty
// post-tiktok-day-one-day-seven-20261123-0327.
//
// The entrypoint is deliberately tiny: it validates the packaged video
// manifest and copies it to the output directory the runner provides.
// The game itself lives in game/starfall.html (playable in a browser,
// ?day=1 for the day-one build, ?day=7 for the day-seven build);
// the video in VIDEO.json is the TikTok the entry is judged on.
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? resolve(HERE, "out");

async function main(): Promise<void> {
  const manifestPath = join(HERE, "VIDEO.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (typeof manifest?.url !== "string" || !manifest.url.startsWith("https://")) {
    throw new Error(`VIDEO.json must carry a valid https video url, got: ${manifest?.url}`);
  }
  // The house only accepts a real TikTok video address (tiktok.com/@<handle>
  // /video/<id>); a short link or the PLACEHOLDER is refused. Warn loudly
  // while the placeholder is still in place so a bad submit is never silent.
  if (!/^https:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+$/.test(manifest.url)) {
    console.warn(
      "starfall: WARNING — VIDEO.json does not look like a TikTok video url yet:",
      manifest.url,
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const target = join(OUTPUT_DIR, "VIDEO.json");
  await copyFile(manifestPath, target);
  const bytes = (await stat(target)).size;
  console.log(`starfall: wrote ${target} (${bytes} bytes) -> ${manifest.url}`);
}

await main();
