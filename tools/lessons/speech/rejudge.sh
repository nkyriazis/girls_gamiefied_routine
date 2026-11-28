#!/usr/bin/env bash
# Judge the lessons' clips again from what Whisper already heard (rejudge.py): seconds, no GPU.
#   tools/lessons/speech/rejudge.sh [<id>…]     (default: every lesson listened to)
set -euo pipefail
cd "$(dirname "$0")/../../.."
ids=("$@"); [ ${#ids[@]} -gt 0 ] || ids=($(cd tools/lessons/work && find . -mindepth 2 -maxdepth 2 -name speech.json | cut -d/ -f2 | sort))
docker run --rm -v "$PWD:/repo" -w /repo/tools/help-voice --entrypoint python help-voice ../lessons/speech/rejudge.py \
  $(printf '/repo/tools/lessons/work/%s ' "${ids[@]}")
docker run --rm -v "$PWD:/repo" alpine chown -R "$(id -u):$(id -g)" $(printf '/repo/tools/lessons/work/%s ' "${ids[@]}")
