#!/usr/bin/env bash
# The owner's sign-off of the owl's words, as two commands around the page (tools/lessons/speech/README.md says what
# the page and the registry are). Everything lives in tools/lessons/work/.signoff/ (git-ignored).
#   tools/lessons/signoff.sh page [<id>…]
#       what waits for the owner's ear, in every lesson listened to (or the ones named): review.html + items.json.
#       An agent of the main session publishes review.html (a private Artifact with a db) and the owner answers there.
#   tools/lessons/signoff.sh apply <verdicts.json> [<id>…]
#       the owner's answers (the page's `verdicts` collection, saved as JSON) into rules.json (speech/apply.mjs),
#       then each lesson's gate: one with nothing left to hear is zipped ("signed"), one that still waits, or whose
#       words must be recorded again, is listed ("waits": tools/lessons/build.sh <id>, then `page` again).
# Nobody but the owner signs a word off: never write verdicts yourself, never edit a status in rules.json.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 1 ] || { sed -n 2,11p "$0"; exit 2; }
what=$1; shift; work=tools/lessons/work; out=$work/.signoff
node() { docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:24-alpine node "$@"; }
listened() { [ $# -gt 0 ] && printf '%s\n' "$@" || (cd $work && find . -mindepth 2 -maxdepth 2 -name speech.json | cut -d/ -f2 | grep -v '^run[0-9]' | sort); }
case $what in
  page)
    mkdir -p "$out"
    tools/lessons/speech/review.sh "$out" "$@"
    echo "$out/review.html  $out/items.json" ;;
  apply)
    [ $# -ge 1 ] && [ -f "$1" ] || { echo "apply needs the owner's answers as a JSON file" >&2; exit 2; }
    [ -f "$out/items.json" ] || { echo "No $out/items.json: the answers belong to a page made by 'signoff.sh page'" >&2; exit 1; }
    [ "$(realpath "$1")" = "$(realpath "$out/verdicts.json" 2>/dev/null)" ] || cp "$1" "$out/verdicts.json"; shift
    node tools/lessons/speech/apply.mjs "$out/verdicts.json" "$out/items.json"
    for id in $(listened "$@"); do
      if node tools/lessons/speech/gate.mjs "$work/$id" >/dev/null 2>&1; then
        tools/lessons/pack.sh "$work/$id/package" "$work/$id.zip" >/dev/null && echo "signed $id  ($work/$id.zip)"
      else echo "waits  $id"; fi
    done ;;
  *) sed -n 2,11p "$0"; exit 2 ;;
esac
