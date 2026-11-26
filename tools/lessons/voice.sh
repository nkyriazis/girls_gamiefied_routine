#!/usr/bin/env bash
# The owl reads a lesson aloud: records every sentence, title, hard word, question and prompt of a prepared package
# in the owl's voice (tools/help-voice: VoxCPM2 speaks, Whisper listens to every take) into <package>/audio/, and
# fills lesson.json's `audio`. Lines already recorded are kept. Needs the NVIDIA GPU. Then pack again.
#   tools/lessons/voice.sh tools/lessons/work/istoria-e-14/package
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 1 ] || { sed -n 2,5p "$0"; exit 2; }
pkg=$1
docker build -q -t help-voice tools/help-voice >/dev/null
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:24-alpine node tools/lessons/lines.mjs "$pkg" > "$pkg/../lines.json"
echo "$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))))" "$pkg/../lines.json") lines to say"
docker run --rm --gpus all -v help-voice-cache:/root/.cache -v "$PWD:/repo" -w /repo/tools/help-voice help-voice \
  sh -c "python -u ../lessons/read_aloud.py /repo/$pkg /repo/$pkg/../lines.json; s=\$?; chown -R $(id -u):$(id -g) /repo/$pkg /repo/$pkg/../voice-report.json out 2>/dev/null; exit \$s" \
  | grep -v ' kept '
