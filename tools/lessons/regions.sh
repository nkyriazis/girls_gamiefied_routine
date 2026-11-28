#!/usr/bin/env bash
# Draw every `spot` question's regions over its picture, to look at before the owner does: each box covers its
# place, none overlap, the right one (green) is the place the question asks for. The others are red.
#   tools/lessons/regions.sh <id> [<out dir>]     → <out dir>/spot-<script index>.jpg   (default: work/<id>/regions)
# Needs the built package (tools/lessons/build.sh <id> --no-voice cuts the pictures).
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 1 ] || { sed -n 2,5p "$0"; exit 2; }
id=${1%/}; id=${id##*/}; pkg=tools/lessons/work/$id/package
out=$(realpath -m "${2:-tools/lessons/work/$id/regions}"); mkdir -p "$out"
[ -f "$pkg/lesson.json" ] || { echo "No $pkg/lesson.json: tools/lessons/build.sh $id --no-voice first" >&2; exit 1; }
# One line per spot: <script index> <picture> <ffmpeg filter>, and the legend on stderr
docker run --rm -v "$PWD":/w -w /w node:24-alpine node -e '
  const lesson = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  lesson.script.forEach((s, i) => {
    if (s.do !== "ask" || s.question.type !== "spot") return;
    const q = s.question;
    console.error(`spot-${i}.jpg  «${q.question}»`);
    q.regions.forEach((r, k) => console.error(`  ${k === q.correct ? "green (right)" : "red"}  ${r.label ?? k}  x ${r.x} y ${r.y} w ${r.w} h ${r.h}`));
    console.log(i, q.image, q.regions.map((r, k) =>
      `drawbox=x=iw*${r.x}/100:y=ih*${r.y}/100:w=iw*${r.w}/100:h=ih*${r.h}/100:color=${k === q.correct ? "lime" : "red"}@0.9:t=5`).join(","));
  });' "$pkg/lesson.json" | while read -r i image filter; do
  docker run --rm -u "$(id -u):$(id -g)" --entrypoint ffmpeg -v "$PWD/$pkg":/in:ro -v "$out":/out linuxserver/ffmpeg \
    -v error -y -i "/in/$image" -vf "$filter" -q:v 3 "/out/spot-$i.jpg" </dev/null
  echo "$out/spot-$i.jpg"
done
