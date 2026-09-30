#!/bin/sh
# Records the owl's voice for every help bubble that has none yet (see README.md).
# Needs the dev frontend container up (it lists the lines) and an NVIDIA GPU.
set -e
cd "$(dirname "$0")"
ROOT=$(cd ../.. && pwd)
docker build -q -t help-voice . >/dev/null
docker compose -f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.dev.yml" exec -T frontend node scripts/help-lines.mjs 2>/dev/null > lines.json
docker run --rm --gpus all -v help-voice-cache:/root/.cache -v "$ROOT:/repo" -w /repo/tools/help-voice help-voice \
  sh -c "python -u record.py lines.json ${1:-} && python quality.py; s=\$?; chown -R $(id -u):$(id -g) out report.json ../../frontend/public/help-voice ../../frontend/src/help/voice; exit \$s"
