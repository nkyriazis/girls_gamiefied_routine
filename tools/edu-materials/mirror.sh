#!/usr/bin/env bash
# Mirror and index the primary-school textbooks: the whole pipeline in one command.
#
#   tools/edu-materials/mirror.sh            fetch what is missing, verify, then index
#   tools/edu-materials/mirror.sh --index    rebuild the index only
#
# Resumable: finished files are skipped, so rerunning retries only what failed. Takes a few
# hours from scratch (about 18 GB), minutes when everything is there. See README.md.
set -uo pipefail
cd "$(dirname "$0")/../.."
HERE=tools/edu-materials
IMAGE=edu-materials-tools
LOGDIR=materials/logs
mkdir -p "$LOGDIR"

# One run at a time: two runs double the load on Photodentro, whose redirector then
# answers 502 to a large share of requests.
exec 9>"$LOGDIR/mirror.lock"
flock -n 9 || { echo "another mirror run is in progress" >&2; exit 1; }

# Live progress in the Claude Code status line when the flow helper is installed,
# plain progress lines on stderr otherwise.
if [ -f ~/.claude/skills/flow/flow.sh ]; then
  source ~/.claude/skills/flow/flow.sh
else
  flow() { echo "== $1" >&2; }
  step() { echo "-- $1" >&2; }
  ok() { echo "   ok ${1:-}" >&2; }
  fail() { echo "   FAILED ${1:-}" >&2; }
  note() { echo "   $1" >&2; }
  progress() { [ -n "${2:-}" ] && (( $1 % 25 == 0 || $1 == $2 )) && echo "   $1/$2 ${3:-}" >&2; return 0; }
fi

run() {  # run <log name> <label> <command...>: log everything, turn [i/N] lines into progress
  local name=$1 label=$2; shift 2
  local log="$LOGDIR/$name.log" fails=0 extra line
  step "$label"
  : > "$log"
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w "$IMAGE" "$@" 2>&1 |
  while IFS= read -r line; do
    echo "$line" >> "$log"
    if [[ $line =~ \[([0-9]+)/([0-9]+)\]\ ([A-Za-z-]+)\ ?(.*) ]]; then
      [[ ${BASH_REMATCH[3]} == FAILED ]] && fails=$((fails + 1))
      extra=""; (( fails )) && extra=" · $fails failed"
      progress "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]} ${BASH_REMATCH[4]##*/}$extra"
    elif [[ $line =~ ^interactive-files\ (.*)\ ([0-9]+)\ files ]]; then
      progress 0 "" "crawling ${BASH_REMATCH[1]}: ${BASH_REMATCH[2]} files"
    fi
  done
  local rc=${PIPESTATUS[0]} failed
  failed=$(grep -c FAILED "$log")
  if (( rc != 0 )); then fail "exit $rc, see $log"; return "$rc"; fi
  if (( failed )); then ok "$failed failed, see $log"; else ok; fi
}

fetch() { run "$1" "$2" python -u $HERE/fetch.py "$1" -j "${3:-2}"; }
count() { ls "$1" 2>/dev/null | wc -l; }

flow "Mirror and index ebooks.edu.gr (Δημοτικό)"
step "building the tools image"
docker build -q -t $IMAGE $HERE >/dev/null && ok || { fail; exit 1; }

if [[ ${1:-} != --index ]]; then
  fetch catalog "catalog of grades K01–K06" 1
  fetch interactive "interactive books: pages and assets" 2
  # Photodentro's redirector fails often; gentle passes until one brings nothing new.
  for pass in 1 2 3 4 5 6; do
    before=$(count materials/photodentro/meta)
    fetch photodentro "learning-object metadata, pass $pass" 2
    after=$(count materials/photodentro/meta)
    note "pass $pass: +$((after - before)), $(count materials/photodentro/missing) never migrated"
    (( after == before )) && break
    sleep 60
  done
  fetch lo-files "learning-object packages" 2
  fetch pdf "PDF books" 3
  fetch verify "checking PDFs"
fi

run index "building the search index" python -u $HERE/index.py build
note "done: $(du -sh materials | cut -f1) in materials/, logs in $LOGDIR/"
