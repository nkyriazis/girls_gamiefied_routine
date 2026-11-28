#!/usr/bin/env bash
# A lesson as a page of text for the owner to read before anything is recorded: every piece (the key sentence, the
# hard words, «Πιο απλά»), every step in order with its question, the right answer and where the text says it, what
# differs on the two paths, the questions for the parent. Nothing a machine checks proves the history or the
# geography right; the owner's eye does. Written to tools/lessons/work/<id>/lesson.md (git-ignored: the book's text).
#   tools/lessons/show.sh <id>
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 1 ] || { sed -n 2,6p "$0"; exit 2; }
id=${1%/}; id=${id##*/}; dir=tools/lessons/work/$id
[ -f "$dir/lesson.src.json" ] || { echo "No $dir/lesson.src.json" >&2; exit 1; }
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:24-alpine node tools/lessons/show.mjs "$dir/lesson.src.json" > "$dir/lesson.md"
echo "$dir/lesson.md: $(wc -l < "$dir/lesson.md") lines"
