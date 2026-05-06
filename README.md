# Talking Posters

Talking Posters turns infographic prompts into interactive poster pages. Each poster is a generated bitmap image with clickable regions that play spoken explanations.

The public website is a viewer for already-generated posters. Creating new posters happens locally.

## Requirements

- macOS, because audio generation uses the built-in `say` command.
- OpenAI Codex CLI, because poster generation is delegated to a Codex agent using the local `$talking-poster` skill.
- A macOS system voice for the poster language.
- `ffmpeg`, used to convert temporary speech audio to MP3.
- Node.js and npm.

Install dependencies:

```bash
npm install
```

## Generate A Poster

Generate a new poster locally with:

```bash
make poster PROMPT="Eine Infografik über Kaninchen"
```

or:

```bash
npm run generate -- "Eine Infografik über Kaninchen"
```

This launches Codex with the `$talking-poster` skill. The agent should:

- generate the poster front with imagegen as a bitmap;
- save it as `posters/<poster-id>/poster.png`;
- manually OCR the infographic;
- convert bullet text into continuous prose for speech;
- create transparent hotspot metadata in `poster.json`;
- pre-generate MP3 files with `npm run audio -- <poster-id>`;
- run `npm run build`.

## Run The App Locally

Start the local app:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

The local app shows the poster gallery, lets you open posters, plays the generated audio, and can remove posters from the local library.

## Voice Configuration

Audio is generated before release, not on click. The generator chooses a voice in this order:

1. CLI override:

   ```bash
   npm run audio -- <poster-id> --voice "Petra (Premium)"
   ```

2. Environment variable:

   ```bash
   TALKING_POSTER_TTS_VOICE="Petra (Premium)" npm run audio -- <poster-id>
   ```

3. Poster metadata in `posters/<poster-id>/poster.json`:

   ```json
   {
     "language": "de-DE",
     "ttsVoice": "Petra (Premium)"
   }
   ```

4. Automatic fallback: the best installed voice for the poster language. If no `language` is set, the script currently detects German vs English from poster text.

To see installed macOS voices:

```bash
say -v "?"
```

To install or change macOS voices, open:

```text
System Settings -> Accessibility -> Spoken Content -> System Voice -> Manage Voices
```

For German posters, install a high-quality German voice such as `Petra (Premium)`. If you use another voice, set `ttsVoice` in the poster JSON or pass `--voice`.
