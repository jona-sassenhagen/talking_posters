#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 0 ]; then
  prompt="$*"
else
  prompt="${PROMPT:-}"
fi

if [ -z "${prompt}" ]; then
  cat >&2 <<'USAGE'
Usage:
  make poster PROMPT="Eine Infografik über Kaninchen"
  npm run generate -- "Eine Infografik über Kaninchen"
USAGE
  exit 2
fi

if ! command -v codex >/dev/null 2>&1; then
  echo 'Error: the "codex" CLI is not available on PATH.' >&2
  exit 127
fi

exec codex "Use \$talking-poster to generate a new interactive talking poster from this prompt: ${prompt}

Follow the skill exactly: generate the visual front with imagegen as a bitmap, save it under posters/<poster-id>/poster.png, manually OCR the generated bitmap, convert all OCR/list text into continuous prose for TTS, create transparent hotspots, update posters/index.json, run npm run audio -- <poster-id> so MP3 files are generated before release, and run npm run build."
