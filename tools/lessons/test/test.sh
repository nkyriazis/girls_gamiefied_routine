#!/usr/bin/env bash
# Checks a built lesson (tools/lessons/work/<id>) with check.mjs, against the book's pages it names and, if given, a
# case file of what was expected of that chapter. Exits 1 when a check fails.
#   tools/lessons/test/test.sh istoria-e-16 [tools/lessons/test/cases/istoria-e-16.json]
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ $# -ge 1 ] || { sed -n 2,4p "$0"; exit 2; }
id=$1; dir=tools/lessons/work/$id
[ -f "$dir/package/lesson.json" ] || { echo "No $dir/package/lesson.json: build it first" >&2; exit 1; }
read -r pdf from to < <(docker run --rm -v "$PWD":/w -w /w node:24-alpine node -e '
  const b = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).book; console.log(b.pdf, b.from, b.to)' "$dir/lesson.src.json")
rm -rf "$dir/pages-text"; mkdir -p "$dir/pages-text"
docker run --rm -u "$(id -u):$(id -g)" -e XDG_CACHE_HOME=/tmp -v "$PWD":/w -w /w edu-materials-tools sh -c \
  'for p in $(seq "$2" "$3"); do pdftotext -f "$p" -l "$p" "materials/pdf/$1" "$4/page-$p.txt"; done' sh "$pdf" "$from" "$to" "$dir/pages-text"
docker run --rm -v "$PWD":/w -w /w node:24-alpine node tools/lessons/test/check.mjs "$dir" ${2:+"$2"}
