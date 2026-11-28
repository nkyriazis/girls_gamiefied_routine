#!/usr/bin/env bash
# The sign-off page: what waits for the owner's ear in every lesson listened to (or the ones named), as one
# self-contained page and the list of its cards (tools/lessons/speech/README.md).
#   tools/lessons/speech/review.sh <out dir> [<id>…]     → <out dir>/review.html, <out dir>/items.json
set -euo pipefail
cd "$(dirname "$0")/../../.."
[ $# -ge 1 ] || { sed -n 2,4p "$0"; exit 2; }
out=$(realpath "$1"); shift; mkdir -p "$out"
dirs=(); for id in "$@"; do dirs+=("/w/tools/lessons/work/$id"); done
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -v "$out":/out -w /w node:24-alpine \
  node tools/lessons/speech/review.mjs /out/review.html /out/items.json "${dirs[@]}"
