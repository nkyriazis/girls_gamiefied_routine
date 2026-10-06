#!/bin/bash
# record.sh <scenario.mjs> [out-dir]: plays a scenario on the dev stack and leaves, in out-dir,
# its screenshots and <name>.mp4 (the screen with what it played). out-dir defaults to the
# scenario's own folder. The dev stack must be up (frontend :5173, backend :3000).
set -e
repo=$(cd "$(dirname "$0")/../.." && pwd)
scenario=$(realpath "$1"); out=$(realpath "${2:-$(dirname "$scenario")}")
case "$scenario$out" in "$repo"*"$repo"*) ;; *) echo "scenario and out-dir must be inside the repo" >&2; exit 1;; esac
docker build -q -t routine-evidence "$repo/tools/evidence" >/dev/null
run=(docker run --rm --network host -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$repo:/repo" -w "/repo${out#$repo}" routine-evidence)
timeout 900 "${run[@]}" node "/repo${scenario#$repo}"
# Every new recording gets its sound
for j in "$out"/*.sound.json; do
  [ -e "$j" ] || continue
  name=$(basename "$j" .sound.json)
  [ "$out/$name.mp4" -nt "$out/$name.webm" ] && continue
  "${run[@]}" env PUB=/repo/frontend/public bash /repo/tools/evidence/mix.sh "$name"
  ls -la "$out/$name.mp4"
done
