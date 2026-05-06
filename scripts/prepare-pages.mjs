import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const posterSource = path.join(root, "posters");
const posterTarget = path.join(distDir, "poster-assets");
const audioSource = path.join(root, "public", "audio");

const index = JSON.parse(await fs.readFile(path.join(posterSource, "index.json"), "utf8"));
const missingAudio = [];

for (const poster of index.posters) {
  const posterConfigPath = path.join(posterSource, poster.id, "poster.json");
  const posterConfig = JSON.parse(await fs.readFile(posterConfigPath, "utf8"));

  for (const section of posterConfig.sections) {
    const audioPath = path.join(audioSource, poster.id, `${section.id}.mp3`);

    try {
      await fs.access(audioPath);
    } catch {
      missingAudio.push(path.relative(root, audioPath));
    }
  }
}

if (missingAudio.length > 0) {
  throw new Error(`Missing prebuilt poster audio:\n${missingAudio.join("\n")}`);
}

await fs.rm(posterTarget, { recursive: true, force: true });
await fs.cp(posterSource, posterTarget, {
  recursive: true,
  filter: (source) => !source.endsWith(".DS_Store")
});

await fs.copyFile(path.join(distDir, "index.html"), path.join(distDir, "404.html"));
await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");

console.log("Copied posters/ to dist/poster-assets/");
console.log("Copied dist/index.html to dist/404.html for GitHub Pages fallback.");
console.log("Created dist/.nojekyll.");
