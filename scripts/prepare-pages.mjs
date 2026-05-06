import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const posterSource = path.join(root, "posters");
const posterTarget = path.join(distDir, "poster-assets");

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
