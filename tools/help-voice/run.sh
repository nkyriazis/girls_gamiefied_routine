#!/bin/sh
# The owl's voice, in one go, on the dev machine (an NVIDIA GPU and Docker; nothing needs
# to be running). Records every line that has no clip yet or changed, fixes loudness,
# listens to everything, checks the screens have a clip for every bubble, and says what to commit.
#   tools/help-voice/run.sh            record what's missing or changed
#   tools/help-voice/run.sh --retry    also try again the lines Whisper didn't hear perfectly
set -e
cd "$(dirname "$0")"
ROOT=$(cd ../.. && pwd)
COMPOSE="docker compose -f $ROOT/docker-compose.yml -f $ROOT/docker-compose.dev.yml"
front() { $COMPOSE run --rm --no-deps -T frontend "$@" 2>/dev/null; }
say() { printf '\n== %s\n' "$*"; }

say "1/5 the voice tools image"
docker build -q -t help-voice . >/dev/null

say "2/5 the owl's lines (every tour, every variant)"
front node scripts/help-lines.mjs > lines.json
python3 -c "import json; print(len(json.load(open('lines.json'))), 'lines')"

say "3/5 recording what's missing or changed, and listening to every take"
docker run --rm --gpus all -v help-voice-cache:/root/.cache -v "$ROOT:/repo" -w /repo/tools/help-voice help-voice \
  sh -c "python -u record.py lines.json ${1:-}; s=\$?; python quality.py >/dev/null 2>&1; chown -R $(id -u):$(id -g) out report.json ../../frontend/public/help-voice ../../frontend/src/help/voice; exit \$s" \
  | grep -v ' kept '

say "4/5 the screens have a clip for every bubble"
front node scripts/help-lines.mjs --check

say "5/5 the audit"
python3 - <<'PY'
import json
R = json.load(open('report.json'))
bad = [e for e in R if not e['ok']]
print(f"{len(R) - len(bad)}/{len(R)} lines pass: heard as written (Whisper), in the owl's voice, clean (SQUIM), "
      f"loudness {min(e['lufs'] for e in R if 'lufs' in e)}..{max(e['lufs'] for e in R if 'lufs' in e)} LUFS")
for e in R:
    if e['cer'] > 0: print(f"  heard differently: «{e['say']}» → «{e.get('shipped_heard', e['heard'])}»")
for e in bad: print(f"  FAILED: «{e['say']}» (reword it, or run again with --retry)")
PY
echo "Listen: tools/help-voice/out/listen.html"
echo "Commit: git add frontend/public/help-voice frontend/src/help/voice/clips.json tools/help-voice/report.json"
