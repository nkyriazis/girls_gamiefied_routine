#!/bin/sh
# End-to-end check of the parent dashboard (#15), all in Docker.
#
#   PIDATA=/path/to/piserve-copy docs/pr-15/run-e2e.sh [script.mjs]
#
# Builds the prod images (nginx + backend) from SRC (default: this checkout),
# starts them on a throwaway copy of piserve's data.json, state.json and
# logs.jsonl (imported into a fresh database on first start, as a deploy
# would), and runs the Playwright script (default parent.e2e.mjs) in
# mcr.microsoft.com/playwright. Kids' photos are replaced by emoji avatars.
# Screenshots land in docs/pr-15/<script name>/.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
SRC=${SRC:-$REPO}
SCRIPT=${1:-parent.e2e.mjs}
: "${PIDATA:?set PIDATA to a directory with a copy of piserve's data.json, state.json and logs.jsonl}"
WORK=${WORK:-$(mktemp -d)}
PORT=${PORT:-8095}
PROJECT=ggr15e2e
SHOTS="$HERE/$(basename "$SCRIPT" .e2e.mjs)"

mkdir -p "$WORK/stack/uploads" "$WORK/e2e/shots"
cp "$HERE/$SCRIPT" "$WORK/e2e/"
cp "$PIDATA/state.json" "$PIDATA/logs.jsonl" "$REPO/backend/exercises.json" "$WORK/stack/"
docker run --rm -v "$PIDATA:/in:ro" -v "$WORK/stack:/out" -u "$(id -u):$(id -g)" node:24-alpine node -e '
  const d = require("/in/data.json");
  d.users.forEach((u, i) => { u.avatar = { type: "emoji", value: ["👧", "👩"][i] || "🙂" }; });
  require("fs").writeFileSync("/out/data.json", JSON.stringify(d, null, 2));'
cat > "$WORK/e2e/compose.e2e.yml" <<YML
services:
  backend:
    volumes:
      - $WORK/stack:/data
      - $WORK/stack/uploads:/app/uploads
YML
C="docker compose -p $PROJECT --project-directory $SRC -f $SRC/docker-compose.yml -f $SRC/docker-compose.override.yml -f $WORK/e2e/compose.e2e.yml"
export FRONTEND_PORT=$PORT NGROK_DOMAIN= NGROK_AUTHTOKEN=
$C up -d --build --quiet-pull 2>&1 | tail -1
until curl -sf "localhost:$PORT/api/users" >/dev/null; do sleep 0.3; done

PW=mcr.microsoft.com/playwright:v1.55.0-noble
[ -d "$WORK/e2e/node_modules/playwright" ] || docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$WORK/e2e:/e2e" -w /e2e $PW \
  sh -c 'echo "{\"type\":\"module\"}" > package.json && npm i -s --no-audit --no-fund playwright@1.55.0'

status=0
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp --network ${PROJECT}_routine-net \
  -v "$WORK/e2e:/e2e" -w /e2e $PW node "$SCRIPT" || status=$?
rm -rf "$SHOTS" && mkdir -p "$SHOTS"
cp "$WORK"/e2e/shots/*.png "$SHOTS/" 2>/dev/null || true
$C down 2>&1 | tail -1
exit $status
