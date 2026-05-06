import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { Poster } from "../shared/types";
import { publicAudioDir, readPoster } from "../server/posterStore";

const execFileAsync = promisify(execFile);

type Voice = {
  name: string;
  locale: string;
  sample: string;
};

type Args = {
  posterId: string;
  voice?: string;
  language?: string;
};

await main();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const poster = await readPoster(args.posterId);
  if (!poster) {
    fail(`Poster "${args.posterId}" was not found.`);
  }

  await assertCommand("say", ["-v", "?"], 'The macOS "say" command is not available. Run on macOS to generate speech.');
  await assertCommand("ffmpeg", ["-version"], 'The "ffmpeg" command is not available on PATH. Install ffmpeg to generate MP3 audio.');

  const voices = await listVoices();
  const language = normalizeLanguage(args.language ?? poster.language ?? detectLanguage(poster));
  const voice = resolveVoice(voices, args.voice ?? process.env.TALKING_POSTER_TTS_VOICE ?? poster.ttsVoice, language);
  const audioDir = path.join(publicAudioDir, poster.id);

  await fs.mkdir(audioDir, { recursive: true });
  await flushAudio(audioDir);

  console.log(`Generating ${poster.sections.length} MP3 files for "${poster.id}"`);
  console.log(`Language: ${language}`);
  console.log(`Voice: ${voice.name} (${voice.locale})`);

  for (const section of poster.sections) {
    const tempPath = path.join(audioDir, `${section.id}.aiff`);
    const mp3Path = path.join(audioDir, `${section.id}.mp3`);
    try {
      await execFileAsync("say", ["-v", voice.name, "-o", tempPath, section.text]);
      await execFileAsync("ffmpeg", ["-y", "-loglevel", "error", "-i", tempPath, "-codec:a", "libmp3lame", "-q:a", "4", mp3Path]);
      console.log(`- ${section.id}.mp3`);
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  }
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let voice: string | undefined;
  let language: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--voice") {
      voice = argv[index + 1];
      index += 1;
    } else if (arg === "--language") {
      language = argv[index + 1];
      index += 1;
    } else {
      positional.push(arg);
    }
  }

  const posterId = positional[0];
  if (!posterId) {
    fail("Usage: npm run audio -- <poster-id> [--voice \"Voice Name\"] [--language de-DE]");
  }

  return { posterId, voice, language };
}

async function listVoices() {
  const result = await execFileAsync("say", ["-v", "?"]);
  const voices = result.stdout
    .split("\n")
    .map((line) => line.match(/^(.+?)\s+([a-z]{2}[_-][A-Z]{2})\s+#\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      name: match[1].trim(),
      locale: match[2].replace("_", "-"),
      sample: match[3].trim()
    }));

  if (voices.length === 0) {
    fail('No voices were returned by "say -v ?".');
  }

  return voices;
}

function resolveVoice(voices: Voice[], configuredVoice: string | undefined, language: string) {
  if (configuredVoice) {
    const exact = voices.find((voice) => voice.name === configuredVoice);
    if (exact) {
      return exact;
    }

    fail(`Configured voice "${configuredVoice}" is not listed by "say -v ?". Available matching language voices: ${voiceNamesForLanguage(voices, language)}`);
  }

  const languagePrefix = language.split("-")[0];
  const candidates = voices.filter((voice) => voice.locale === language || voice.locale.startsWith(`${languagePrefix}-`));
  if (candidates.length === 0) {
    fail(`No macOS voices are installed for detected language "${language}".`);
  }

  return candidates.sort((a, b) => scoreVoice(b, language) - scoreVoice(a, language))[0];
}

function scoreVoice(voice: Voice, language: string) {
  let score = 0;
  if (voice.locale === language) {
    score += 1000;
  }
  if (voice.name.includes("(Premium)")) {
    score += 500;
  }
  if (voice.name.includes("(Enhanced)")) {
    score += 250;
  }
  if (/siri/i.test(voice.name)) {
    score += 100;
  }
  return score;
}

function detectLanguage(poster: Poster) {
  const text = `${poster.title} ${poster.prompt} ${poster.sections.map((section) => section.text).join(" ")}`;
  const lower = text.toLowerCase();
  const germanScore = countMatches(lower, [
    " der ",
    " die ",
    " das ",
    " und ",
    " ist ",
    " sind ",
    " nicht ",
    " für ",
    " über ",
    "ä",
    "ö",
    "ü",
    "ß"
  ]);
  const englishScore = countMatches(lower, [" the ", " and ", " is ", " are ", " for ", " with ", " from "]);

  return germanScore >= englishScore ? "de-DE" : "en-US";
}

function countMatches(value: string, needles: string[]) {
  return needles.reduce((score, needle) => score + (value.includes(needle) ? 1 : 0), 0);
}

function normalizeLanguage(language: string) {
  return language.replace("_", "-");
}

function voiceNamesForLanguage(voices: Voice[], language: string) {
  const prefix = language.split("-")[0];
  return voices
    .filter((voice) => voice.locale === language || voice.locale.startsWith(`${prefix}-`))
    .map((voice) => voice.name)
    .join(", ");
}

async function flushAudio(audioDir: string) {
  const entries = await fs.readdir(audioDir).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".mp3") || entry.endsWith(".aiff"))
      .map((entry) => fs.rm(path.join(audioDir, entry), { force: true }))
  );
}

async function assertCommand(command: string, args: string[], message: string) {
  try {
    await execFileAsync(command, args);
  } catch {
    fail(message);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
