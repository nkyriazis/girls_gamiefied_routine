#!/usr/bin/env bash
# One line in the rounds log, tools/lessons/work/rounds.jsonl (local: this machine's timings, git-ignored):
#   log.sh <step> <lesson or -> <seconds> [<json object of counts>]
# `node tools/lessons/speech/rounds.mjs` shows them by round, so each round can be compared with the last.
set -euo pipefail
cd "$(dirname "$0")/../../.."
printf '{"at":"%s","step":"%s","lesson":"%s","secs":%s,"n":%s}\n' "$(date -Iseconds)" "$1" "$2" "$3" "${4:-{\}}" \
  >> tools/lessons/work/rounds.jsonl
