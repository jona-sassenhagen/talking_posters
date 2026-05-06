import { promises as fs } from "node:fs";
import path from "node:path";
import type { Poster, PosterIndex, PosterSummary } from "../shared/types";

export const rootDir = process.cwd();
export const postersDir = path.join(rootDir, "posters");
export const publicAudioDir = path.join(rootDir, "public", "audio");
export const indexPath = path.join(postersDir, "index.json");

export async function ensurePosterStorage() {
  await fs.mkdir(postersDir, { recursive: true });
  await fs.mkdir(publicAudioDir, { recursive: true });
  try {
    await fs.access(indexPath);
  } catch {
    await writePosterIndex({ posters: [] });
  }
}

export async function readPosterIndex(): Promise<PosterIndex> {
  await ensurePosterStorage();
  const raw = await fs.readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as PosterIndex;
  return { posters: Array.isArray(parsed.posters) ? parsed.posters : [] };
}

export async function writePosterIndex(index: PosterIndex) {
  await fs.mkdir(postersDir, { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function addOrReplacePosterSummary(summary: PosterSummary) {
  const index = await readPosterIndex();
  const withoutExisting = index.posters.filter((poster) => poster.id !== summary.id);
  await writePosterIndex({
    posters: [summary, ...withoutExisting].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  });
}

export async function removePosterSummary(id: string) {
  const index = await readPosterIndex();
  const nextPosters = index.posters.filter((poster) => poster.id !== id);
  if (nextPosters.length === index.posters.length) {
    return false;
  }

  await writePosterIndex({ posters: nextPosters });
  return true;
}

export async function readPoster(id: string): Promise<Poster | null> {
  if (!isSafeId(id)) {
    return null;
  }

  const posterPath = path.join(postersDir, id, "poster.json");
  try {
    const raw = await fs.readFile(posterPath, "utf8");
    return JSON.parse(raw) as Poster;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function isSafeId(id: string) {
  return /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(id);
}

export function posterAssetPath(id: string, filename: string) {
  return path.join(postersDir, id, filename);
}
