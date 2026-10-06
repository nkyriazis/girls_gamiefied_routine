#!/bin/bash
# dev.sh <helper> [args]: runs a dev/ helper against the dev stack's database, to set a scene.
#   dev.sh problem u1 g3-world-012   a kid's problem for today is this one, fresh
#   dev.sh plain                     today's plain exercises fresh again, both kids
#   dev.sh clear-runs                no flow or routine on screen
#   dev.sh stars u1 100 u2 20        set balances, clear their pending gifts and rewards
# Dev stack only: never against piserve.
set -e
repo=$(cd "$(dirname "$0")/../.." && pwd)
dc() { docker compose -f "$repo/docker-compose.yml" -f "$repo/docker-compose.dev.yml" "$@"; }
[ -n "$1" ] || { sed -n "2,7p" "$0" | sed "s/^# //"; exit 1; }
h=$1; shift
dc cp "$repo/tools/evidence/dev/$h.js" "backend:/tmp/$h.js" >/dev/null 2>&1
dc exec -T backend node "/tmp/$h.js" "$@"
