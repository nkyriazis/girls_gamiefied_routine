#!/usr/bin/env bash
# A video of a built lesson played through on the kids' screen, for the owner to watch before importing it on the Pi:
# tools/lessons/work/<id>.zip → tools/lessons/work/<id>.mp4 (compressed, ~10 min, ~15 MB). Nothing to choose: what
# the kid does (wrong tries, hard words, «Πιο απλά») comes from the lesson (video/course.mjs plan()). The dev stack
# must be up; this replaces the lesson in its library and clears the routines on screen.
#   tools/lessons/video.sh istoria-e-14 [--read]     (--read: she reads alone; default: the owl reads)
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 1 ] || { sed -n 2,6p "$0"; exit 2; }
id=${1%/}; id=${id##*/}; mode=listen
[ "${2:-}" = --read ] && mode=read
work=tools/lessons/work; out=$work/$id/video
[ -f "$work/$id.zip" ] || { echo "No $work/$id.zip: tools/lessons/build.sh $id first" >&2; exit 1; }
curl -sf -o /dev/null localhost:5173/api/debug/schedule || {
  echo "The dev stack is down: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d" >&2; exit 1; }

# A schedule firing mid-video would cover the lesson with a routine or an alarm
soon=$(curl -s localhost:5173/api/debug/schedule | docker run --rm -i node:24-alpine node -e '
  let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
    const now = Date.now();
    console.log(JSON.parse(s).schedules.filter(x => new Date(x.nextRun) - now < 25 * 60e3).map(x => `${x.id} at ${x.nextRunLocal}`).join(", "));
  });')
[ -z "$soon" ] || { echo "A schedule starts within 25 minutes ($soon) and would cover the video: try after it" >&2; exit 1; }

tools/evidence/dev.sh clear-runs >/dev/null
rm -rf "$out"; mkdir -p "$out"
echo "import { course } from '../../../video/course.mjs'; await course('$id', '$mode');" > "$out/$id.mjs"
echo "Recording $id ($mode), about 10 minutes"
tools/evidence/record.sh "$out/$id.mjs" > "$out/record.log" 2>&1 || { tail -5 "$out/record.log" >&2; exit 1; }
if grep -qE "CRASHED|console error" "$out/record.log"; then grep -E "CRASHED|console error" "$out/record.log" | head -3 >&2; exit 1; fi
docker run --rm -u "$(id -u):$(id -g)" --entrypoint ffmpeg -v "$PWD":/w -w /w linuxserver/ffmpeg -v error -y -i "$out/$id.mp4" \
  -c:v libx264 -crf 30 -preset slow -c:a aac -b:a 96k "$work/$id.mp4"
echo "$work/$id.mp4: $(du -h "$work/$id.mp4" | cut -f1), $(grep -c '^\[step' "$out/record.log") steps played"
