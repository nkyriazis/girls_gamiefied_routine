#!/usr/bin/env bash
# How long a stage of making a lesson took, into the rounds log (tools/lessons/work/rounds.jsonl, speech/log.sh), so
# each round can be compared with the last. The `lesson` workflow (.claude/workflows/lesson.js) has every stage call
# this first and last; the time the owner takes between stages is not in it.
#   tools/lessons/stage.sh start <stage> <id or -> [<started, as date +%s>]
#   tools/lessons/stage.sh end   <stage> <id or -> [<json object of counts>]
# Logged as step "stage:<stage>" (make, signoff, apply, review), apart from voice.sh's and the sign-off page's own lines.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 3 ] || { sed -n 2,7p "$0"; exit 2; }
what=$1; stage=$2; id=$3; work=tools/lessons/work
mark=$work/$([ "$id" = - ] && echo "" || echo "$id/").stage-$stage
case $what in
  start) mkdir -p "$(dirname "$mark")"; echo "${4:-$(date +%s)}" > "$mark" ;;   # a 4th word: when it really started (date +%s)
  end)   [ -f "$mark" ] || { echo "stage $stage of $id was never started: nothing logged" >&2; exit 0; }
         secs=$(( $(date +%s) - $(cat "$mark") )); rm -f "$mark"
         tools/lessons/speech/log.sh "stage:$stage" "$id" "$secs" "${4:-{\}}"
         echo "stage $stage of $id: $secs s" ;;
  *)     sed -n 2,7p "$0"; exit 2 ;;
esac
