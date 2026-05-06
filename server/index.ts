import { promises as fs } from "node:fs";
import path from "node:path";
import express from "express";
import { createServer as createViteServer } from "vite";
import {
  ensurePosterStorage,
  isSafeId,
  posterAssetPath,
  publicAudioDir,
  readPoster,
  readPosterIndex,
  removePosterSummary,
  rootDir
} from "./posterStore";

const app = express();
const port = Number(process.env.PORT ?? 5173);
const isProduction = process.env.NODE_ENV === "production";

await ensurePosterStorage();

app.use(express.json({ limit: "1mb" }));
app.use("/audio", express.static(path.join(rootDir, "public", "audio")));
app.use("/poster-assets", express.static(path.join(rootDir, "posters")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/posters", async (_req, res, next) => {
  try {
    res.json(await readPosterIndex());
  } catch (error) {
    next(error);
  }
});

app.get("/api/posters/:id", async (req, res, next) => {
  try {
    const poster = await readPoster(req.params.id);
    if (!poster) {
      res.status(404).json({ error: `Poster "${req.params.id}" was not found.` });
      return;
    }
    res.json(poster);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/posters/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isSafeId(id)) {
      res.status(400).json({ error: "Invalid poster id." });
      return;
    }

    const posterDir = path.join(rootDir, "posters", id);
    const audioDir = path.join(publicAudioDir, id);
    const [removedFromIndex, posterFolderExists, audioFolderExists] = await Promise.all([
      removePosterSummary(id),
      pathExists(posterDir),
      pathExists(audioDir)
    ]);

    if (!removedFromIndex && !posterFolderExists && !audioFolderExists) {
      res.status(404).json({ error: `Poster "${id}" was not found.` });
      return;
    }

    await Promise.all([fs.rm(posterDir, { recursive: true, force: true }), fs.rm(audioDir, { recursive: true, force: true })]);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/audio", async (req, res, next) => {
  try {
    const { posterId, sectionId } = req.body as {
      posterId?: string;
      sectionId?: string;
    };

    if (!posterId || !sectionId || !isSafeId(posterId) || !isSafeSectionId(sectionId)) {
      res.status(400).json({ error: "posterId and sectionId are required." });
      return;
    }

    const poster = await readPoster(posterId);
    if (!poster) {
      res.status(404).json({ error: `Poster "${posterId}" was not found.` });
      return;
    }

    const section = poster.sections.find((candidate) => candidate.id === sectionId);
    if (!section) {
      res.status(404).json({ error: `Section "${sectionId}" was not found.` });
      return;
    }

    const audioDir = path.join(publicAudioDir, posterId);
    const audioPath = path.join(audioDir, `${sectionId}.mp3`);
    const audioUrl = `/audio/${posterId}/${sectionId}.mp3`;

    try {
      await fs.access(audioPath);
    } catch {
      res.status(409).json({
        error: `Audio for "${posterId}/${sectionId}" has not been generated. Run: npm run audio -- ${posterId}`
      });
      return;
    }

    res.json({ url: audioUrl, generated: true });
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(rootDir, "dist", "index.html"));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Talking Poster running at http://localhost:${port}`);
});

function isSafeSectionId(id: string) {
  return /^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$|^[a-z0-9]$/.test(id);
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
