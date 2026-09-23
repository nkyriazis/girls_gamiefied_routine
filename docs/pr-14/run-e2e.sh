#!/bin/sh
# End-to-end sync check for #14, all in Docker: builds the prod images, starts
# them on a throwaway copy of backend/data.json, drives two kids' dashboards
# and a parent dashboard with Playwright (sync.e2e.mjs), kills/restarts and
# pauses the backend when the script asks, and writes the screenshots to docs/pr-14/.
set -e
REPO=$(cd "$(dirname "$0")/../.." && pwd)
WORK=${WORK:-$(mktemp -d)}
PORT=${PORT:-8094}
PROJECT=ggr14e2e
mkdir -p "$WORK/stack/uploads" "$WORK/e2e/shots"
cp "$REPO/docs/pr-14/sync.e2e.mjs" "$WORK/e2e/"
cp "$REPO/backend/exercises.json" "$WORK/stack/"
# Mock data with emoji avatars (the mock's avatar images are not in the repo)
docker run --rm -v "$REPO/backend:/in:ro" -v "$WORK/stack:/out" -u "$(id -u):$(id -g)" node:24-alpine node -e '
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
C="docker compose -p $PROJECT -f $REPO/docker-compose.yml -f $REPO/docker-compose.override.yml -f $WORK/e2e/compose.e2e.yml"
export FRONTEND_PORT=$PORT NGROK_DOMAIN= NGROK_AUTHTOKEN=
$C up -d --build --quiet-pull 2>&1 | tail -1
until curl -sf "localhost:$PORT/api/users" >/dev/null; do sleep 0.3; done

PW=mcr.microsoft.com/playwright:v1.55.0-noble
[ -d "$WORK/e2e/node_modules/playwright" ] || docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$WORK/e2e:/e2e" -w /e2e $PW \
  sh -c 'echo "{\"type\":\"module\"}" > package.json && npm i -s --no-audit --no-fund playwright@1.55.0'

echo idle > "$WORK/e2e/signal"
# Serve the script's requests: kill (then start again), pause, unpause.
reply() { echo "$1" > "$WORK/e2e/signal"; }
(
  while :; do
    case "$(cat "$WORK/e2e/signal")" in
      kill)
        echo "[host] docker compose kill backend"; $C kill backend 2>&1 | sed 's/^/[host] /'; reply killed
        sleep 5
        echo "[host] docker compose start backend"; $C start backend 2>&1 | sed 's/^/[host] /'
        until curl -sf "localhost:$PORT/api/users" >/dev/null; do sleep 0.2; done
        echo "[host] backend answers again"; reply started ;;
      pause) echo "[host] docker compose pause backend"; $C pause backend 2>&1 | sed 's/^/[host] /'; reply paused ;;
      unpause) echo "[host] docker compose unpause backend"; $C unpause backend 2>&1 | sed 's/^/[host] /'; reply unpaused ;;
    esac
    sleep 0.2
  done
) &
status=0
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp --network ${PROJECT}_routine-net \
  -v "$WORK/e2e:/e2e" -v "$WORK/stack:/stack" -w /e2e $PW node sync.e2e.mjs || status=$?
kill $! 2>/dev/null || true
rm -f "$REPO"/docs/pr-14/*.png
cp "$WORK"/e2e/shots/*.png "$REPO/docs/pr-14/"
$C down 2>&1 | tail -1
exit $status
