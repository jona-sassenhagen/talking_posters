---
name: talking-poster
description: Generate bitmap-first interactive talking posters in the local talking_poster framework. Use when creating a new poster from a prompt, replacing a poster visual with imagegen output, mapping image regions to speech, transcribing infographic text, converting bullet text to prose for TTS, or prebuilding poster audio files.
metadata:
  short-description: Create imagegen talking posters
---

# Talking Poster

Use this skill in `/Users/jona/talking_poster` to create or update interactive poster pages. The poster visual must come from image generation as a bitmap. The web app should mainly provide transparent click targets and text-to-speech playback.

## Core Rules

- Generate the poster front with the `imagegen` skill / built-in `image_gen` tool. Do not substitute SVG, HTML/CSS drawings, or placeholders for the main poster.
- Always generate posters as `2240x3168` PNGs when size control is available. This is the project standard: A4 portrait-like, multiple-of-16 dimensions, 7.1MP, and only 0.005% off A4's `sqrt(2)` aspect ratio. If using built-in imagegen without explicit size control, prompt for `2240x3168` and reject landscape or square variants.
- Copy the generated bitmap into `posters/<poster-id>/poster.png`. Keep the original generated image in `$CODEX_HOME/generated_images/...`.
- The poster viewer should show the infographic itself, not explanatory side panels. Visible UI should be minimal; transparent hotspots may exist over the bitmap.
- Use manual OCR from the generated bitmap to identify the visible information regions.
- Always convert OCR bullet/list text into natural continuous prose before storing it in `poster.json` for TTS. Never release bullet-style or list-fragment speech text.
- Keep hotspot coordinates as percentages relative to the bitmap image.
- Generate all MP3 audio files before release with `npm run audio -- <poster-id>`. Runtime click handling must not synthesize speech on the fly.

## Existing App Shape

Assume this structure unless the build or file reads prove it has changed. Do not spend the first response explaining that you are rediscovering `main.tsx` or the schema; use the facts below and do a quick verification only when needed.

Important files:

- `posters/index.json`: gallery index.
- `posters/<poster-id>/poster.json`: poster metadata and hotspot/TTS config.
- `posters/<poster-id>/poster.png`: imagegen bitmap poster.
- `Makefile` and `scripts/make-poster.sh`: terminal entry points that invoke Codex with this skill.
- `scripts/generate-audio.ts`: pre-generates section MP3s for a poster and flushes stale audio first.
- `src/main.tsx`: React gallery/viewer and transparent hotspot behavior.
- `server/index.ts`: serves poster metadata and prebuilt audio during normal app use.
- `public/audio/<poster-id>/`: generated MP3 speech cache.

Stable runtime behavior:

- Gallery route `/` reads `GET /api/posters` and shows summaries from `posters/index.json`.
- Poster route `/poster/<poster-id>` reads `GET /api/posters/<poster-id>`.
- Poster images are served from `/poster-assets/<poster-id>/poster.png`, backed by `posters/<poster-id>/poster.png`.
- Audio is requested with `POST /api/audio` using `{ posterId, sectionId }`.
- Audio is cached as `public/audio/<poster-id>/<section-id>.mp3` and served as `/audio/<poster-id>/<section-id>.mp3`.
- The server only returns existing MP3 files. It does not synthesize audio on demand.
- `scripts/generate-audio.ts` uses macOS `say` to create temporary speech audio and `ffmpeg` to convert/cache MP3 before handoff.
- Voice configuration order is: CLI `--voice`, `TALKING_POSTER_TTS_VOICE`, poster `ttsVoice`, then automatic best voice for the poster language.
- Poster language is configured by `language` in `poster.json`; if absent, `scripts/generate-audio.ts` detects German vs English from poster text and chooses a matching Premium voice when available.
- The viewer in `src/main.tsx` already renders only the bitmap plus transparent hotspot buttons. It should not show a visible section list or explanatory sidebar.

Main app contracts:

- `src/main.tsx` maps `poster.sections` into absolutely positioned transparent buttons over the poster image.
- Hotspot bounds are percentages via inline `left`, `top`, `width`, and `height`.
- Clicking a hotspot sends `{ posterId, sectionId }` to `/api/audio`, then plays the returned pre-generated MP3 URL in the browser.
- Audio files must already exist. Missing audio is a release error; run `npm run audio -- <poster-id>`.
- Labels should remain available through `aria-label` and `title`; visible speech-panel UI is intentionally absent.

Supported terminal commands:

```bash
make poster PROMPT="Eine Infografik über Kaninchen"
npm run generate -- "Eine Infografik über Kaninchen"
```

Poster schema:

```json
{
  "id": "poster-id",
  "title": "Poster title",
  "prompt": "Original prompt",
  "image": "/poster-assets/poster-id/poster.png",
  "createdAt": "ISO timestamp",
  "language": "de-DE",
  "ttsVoice": "Optional installed macOS voice name",
  "sections": [
    {
      "id": "section-id",
      "label": "Visible region name",
      "text": "Natural prose for TTS, based on the visible infographic text.",
      "x": 0,
      "y": 0,
      "width": 100,
      "height": 100
    }
  ]
}
```

## Workflow

1. Work from the app contracts above. Read `posters/index.json` and a nearby `poster.json`; only read `src/main.tsx` or `server/index.ts` if changing viewer/server behavior or diagnosing a mismatch.
2. Create a stable lowercase poster id from the prompt, using ASCII letters, numbers, and dashes.
3. Generate a portrait infographic bitmap with `image_gen`.
   - Prompt for a finished educational/scientific poster image, not a website mockup.
   - Require the project-standard bitmap size: `2240x3168` PNG, A4 portrait-like. If the tool cannot set size directly, include `target bitmap size 2240x3168 px` in the prompt.
   - Request large legible labels and visually separated information zones for later hotspots.
   - Avoid browser chrome, UI controls, buttons, watermarks, logos, QR codes, and tiny paragraphs.
4. Copy the selected generated PNG into `posters/<poster-id>/poster.png`.
5. Inspect the bitmap with `view_image`.
6. Manually OCR the visible text. Capture the meaning of each panel or region.
7. Rewrite each region’s OCR into continuous prose for TTS.
   - Preserve facts from the infographic.
   - Remove bullet syntax, numbering noise, and visual shorthand.
   - Keep prose concise and spoken-word friendly.
8. Create or update `posters/<poster-id>/poster.json` with sections and percentage bounds.
9. Add or update the summary in `posters/index.json`.
10. Set `language` in `poster.json` when known, for example `de-DE` for German or `en-US` for English. Only set `ttsVoice` if the user explicitly wants a particular installed macOS voice.
11. Generate all audio before release:
    ```bash
    npm run audio -- <poster-id>
    ```
    This flushes old MP3/AIFF files, chooses the configured voice or the highest-quality voice for the detected/configured language, and writes `public/audio/<poster-id>/<section-id>.mp3`.
12. Run `npm run build`.
13. Do not start the dev server as part of this skill. Handoff after files, audio, and `npm run build` are complete.

## Image Prompt Template

Use this shape and adapt to the user prompt:

```text
Use case: infographic-diagram
Asset type: bitmap poster image used as the visual front of an interactive talking-poster web app
Primary request: <user prompt>
Create a polished A4 portrait-format educational infographic in <language> about <topic>. Target bitmap size: 2240x3168 px PNG. Use a consistent A4-like portrait aspect ratio; no landscape or square composition. The image should be a finished bitmap poster, not a website mockup and not vector/SVG. Use a clean editorial science-poster layout with a strong central subject and clearly separated visual information zones. Include concise <language> labels only, with large legible text. Use high contrast and a coherent topic-appropriate palette. Avoid tiny paragraphs, clutter, UI controls, browser chrome, buttons, watermarks, signatures, logos, QR codes, and fake app interface elements. Leave enough visual separation between zones so transparent web overlays can be placed over them later.
```

## TTS Prose Pattern

Bad TTS text:

```text
3. Körper. Dichtes Fell. Schwarze Haut. Dicke Speckschicht. Große Pfoten.
```

Good TTS text:

```text
Der Körper des Eisbären ist für das Leben in der Kälte gebaut. Sein dichtes Fell isoliert und hält warm. Die schwarze Haut nimmt Wärme von der Sonne auf. Eine dicke Speckschicht speichert Energie, und große Pfoten verteilen das Gewicht auf dem Eis.
```

## Viewer Expectations

The individual poster route should prioritize the bitmap:

- show the poster image as the main surface;
- place transparent `button` hotspots over regions;
- keep labels available through `aria-label`/`title`, not visible panels;
- provide keyboard focus indication without adding permanent overlays;
- do not add a visible “sections” list unless the user explicitly requests it.

## Release Checks

- The main poster asset is a project-local PNG generated by imagegen.
- The poster bitmap uses the project-standard target, `2240x3168` PNG, or the nearest available output if explicit size control was unavailable.
- Every `sections[].text` value is continuous prose suitable for spoken audio, not OCR bullets, headings, list fragments, or copied visual shorthand.
- `npm run audio -- <poster-id>` was run after final prose text changes, so all MP3 files exist before handoff.
- If no `ttsVoice` is configured, the audio generator selected the highest-quality installed voice for the poster language.
- Hotspot regions match the bitmap after inspecting the image.
- `npm run build` passes.
