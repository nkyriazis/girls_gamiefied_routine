#!/usr/bin/env bash
# Build a lesson package from its source, in one go: tools/lessons/work/<id>/lesson.src.json → tools/lessons/work/<id>.zip.
# Cuts the pictures and the book's pages from the PDF, writes package/lesson.json, checks it as the Pi will, records
# the owl's voice for every new or changed line (GPU; --no-voice skips it), refuses words the owner hasn't heard, and zips. Stops at the first problem.
#   tools/lessons/build.sh istoria-e-14 [--no-voice]
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 1 ] || { sed -n 2,5p "$0"; exit 2; }
id=${1%/}; id=${id##*/}; dir=tools/lessons/work/$id; voice=1
[ "${2:-}" = --no-voice ] && voice=0
[ -f "$dir/lesson.src.json" ] || { echo "No $dir/lesson.src.json" >&2; exit 1; }
node() { docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:24-alpine node "$@"; }

echo "== 1/4 lesson.json and what to cut"
node tools/lessons/compile.mjs "$dir" > "$dir/jobs.txt"

echo "== 2/4 the pictures and the book's pages"
IMAGE=edu-materials-tools
docker image inspect $IMAGE >/dev/null 2>&1 || docker build -q -t $IMAGE tools/edu-materials >/dev/null
rm -rf "$dir/package/images" "$dir/package/pages"; mkdir -p "$dir/package/images" "$dir/package/pages"
docker run --rm -u "$(id -u):$(id -g)" -e XDG_CACHE_HOME=/tmp -v "$PWD":/w -w /w $IMAGE sh -euc '
  cd "$1"; pdf=; while read -r kind a b c d e f; do case $kind in
    pdf)  pdf=/w/$a ;;
    page) pdftoppm -f "$a" -l "$a" -scale-to-x 1000 -scale-to-y -1 -jpeg -jpegopt quality=78 -singlefile "$pdf" "package/${b%.jpg}" ;;
    crop) pdftoppm -f "$a" -l "$a" -r 150 -x "$b" -y "$c" -W "$d" -H "$e" -jpeg -jpegopt quality=82 -singlefile "$pdf" "package/${f%.jpg}"
          echo "  $f" ;;
    join) ;;
  esac; done < jobs.txt' sh "$dir"
# A picture of several boxes: the parts side by side, the same height, a white gap between (ffmpeg)
{ grep '^join ' "$dir/jobs.txt" || true; } | while read -r _ out parts; do
  set -- $parts; inputs=; chain=; k=0
  for p in "$@"; do inputs="$inputs -i package/$p"; chain="$chain[$k]scale=-2:400,pad=iw+24:ih:12:0:white[s$k];"; k=$((k+1)); done
  docker run --rm -u "$(id -u):$(id -g)" --entrypoint ffmpeg -v "$PWD/$dir":/w -w /w linuxserver/ffmpeg -v error -y $inputs \
    -filter_complex "$chain$(for i in $(seq 0 $((k-1))); do printf '[s%d]' "$i"; done)hstack=inputs=$k" -q:v 3 "package/$out" </dev/null
  (cd "$dir/package" && rm -f "$@"); echo "  $out ($k parts)"
done

echo "== 3/4 check: as the Pi will, then what the skill asks (a LOOK is for you to judge; a FAIL stops the build)"
tools/lessons/pack.sh "$dir/package" "$dir/.check.zip" >/dev/null && rm -f "$dir/.check.zip"  # the zip comes last, once the gate passes
tools/lessons/test/test.sh "$id" | grep -vE '^PASS' || true
tools/lessons/test/test.sh "$id" >/dev/null || { echo "Fix the FAILs in $dir/lesson.src.json and build again" >&2; exit 1; }

if [ $voice = 1 ]; then
  echo "== 4/4 the owl's voice"
  tools/lessons/voice.sh "$dir/package"
  # The preview, for the video on the dev stack only (video.sh): made whatever the gate says, never imported to the Pi
  tools/lessons/pack.sh "$dir/package" "$dir.preview.zip" >/dev/null
  # Every word the owl says was heard by the owner, once (tools/lessons/speech/README.md)
  node tools/lessons/speech/gate.mjs "$dir" || exit 1
else
  echo "== 4/4 the owl's voice: skipped (--no-voice); lines not yet recorded play silent"
fi
tools/lessons/pack.sh "$dir/package" "$dir.zip"
echo "Look at each picture once (the box is yours to check): $dir/package/images/"
