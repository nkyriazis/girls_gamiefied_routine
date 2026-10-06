#!/bin/bash
# restore-backup.sh [-y] <backup-folder>: put one of the daily backups back (see BACKUP.md).
#
#   ./restore-backup.sh /mnt/usb/routine-backups/2026-10-05_031700
#
# It takes deploy-rpi.sh's backups/<stamp>/ too (made with the backend stopped, no uploads/: the
# live uploads/ stay). data.json and exercises.json are git-ignored, so git never sees a restore.
#
# 1. verifies the backup against its SHA256SUMS (stops on any mismatch, before touching anything)
# 2. stops the backend
# 3. moves the current data.json, exercises.json, routine.db (+ -wal, -shm) and uploads/ aside
#    (exercises.json and uploads/ only when the backup has them), into
#    backups/pre-restore-<stamp>/: nothing is deleted, and no stale -wal can be replayed onto the
#    restored database (with its own SHA256SUMS, so `./restore-backup.sh backups/pre-restore-<stamp>` undoes it)
# 4. copies the backup in, checks the copies against SHA256SUMS, gives each file the owner of the file it
#    replaces
# 5. starts the backend and prints the balances
# The files in backend/ are often root's (the container made them), so steps 3 and 4 run as root in a
# one-off container of the backend's own image, with the checkout and the backup mounted.
# COMPOSE picks the stack (default: the release files, as deploy-rpi.sh). On the dev stack:
#   COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml" ./restore-backup.sh <folder>
set -euo pipefail
cd "$(dirname "$0")"

yes=0
[ "${1:-}" = "-y" ] && { yes=1; shift; }
[ $# -eq 1 ] || { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
[ -d "$1" ] || { echo "No folder $1" >&2; exit 1; }
src=$(cd "$1" && pwd)

if [ -z "${COMPOSE:-}" ]; then
  if docker compose version >/dev/null 2>&1; then dc="docker compose"; else dc="docker-compose"; fi
  COMPOSE="$dc -f docker-compose.yml -f docker-compose.release.yml"
fi

# 1. The backup is whole
for f in SHA256SUMS routine.db data.json; do
  [ -f "$src/$f" ] || { echo "$src has no $f: not a backup made by the backend" >&2; exit 1; }
done
echo "Verifying $src against its SHA256SUMS..."
(cd "$src" && sha256sum --quiet -c SHA256SUMS) || { echo "Checksum mismatch: nothing was changed." >&2; exit 1; }
echo "  all $(wc -l < "$src/SHA256SUMS") files match"

if [ $yes -eq 0 ]; then
  read -r -p "Stop the backend and replace the live data with this backup? [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Nothing was changed."; exit 1; }
fi

container=$($COMPOSE ps -aq backend)
[ -n "$container" ] || { echo "No backend container in this stack (COMPOSE=$COMPOSE)" >&2; exit 1; }
image=$(docker inspect -f '{{.Config.Image}}' "$container")
stamp=$(date +%Y%m%d-%H%M%S)
aside="backups/pre-restore-$stamp"

# 2. Stop the backend (a clean stop folds the WAL into routine.db, which goes aside whole)
echo "Stopping the backend..."
$COMPOSE stop backend

# 3 and 4, as root
mkdir -p backups
docker run --rm -e ASIDE="$aside" -v "$PWD:/repo" -v "$src:/restore:ro" --entrypoint sh "$image" -euc '
  set -o pipefail
  cd /repo
  mkdir -p "$ASIDE"
  chown "$(stat -c %u:%g backups)" "$ASIDE"
  for f in data.json exercises.json routine.db routine.db-wal routine.db-shm uploads; do
    owner=$(stat -c %u:%g backend)
    case "$f" in
      # A backup without one (a deploy backup has no uploads/): the live one stays, rather than none
      exercises.json|uploads) if [ ! -e "/restore/$f" ] && [ -e "backend/$f" ]; then echo "  kept       backend/$f (not in this backup)"; continue; fi ;;
    esac
    if [ -e "backend/$f" ]; then
      owner=$(stat -c %u:%g "backend/$f")
      mv "backend/$f" "$ASIDE/$f"
      echo "  set aside  backend/$f -> $ASIDE/$f"
    fi
    if [ -e "/restore/$f" ]; then
      cp -a "/restore/$f" "backend/$f"
      chown -R "$owner" "backend/$f"
      echo "  restored   backend/$f"
    fi
  done
  [ -d backend/uploads ] || { mkdir backend/uploads; chown "$(stat -c %u:%g backend)" backend/uploads; }
  # The files set aside get their own SHA256SUMS, so this script can put them back too
  (cd "$ASIDE" && find . -type f -exec sha256sum {} + | sed "s|  \./|  |" > /tmp/sums && cat /tmp/sums > SHA256SUMS)
  echo "Checking the restored files against SHA256SUMS..."
  cd backend && sha256sum -c /restore/SHA256SUMS | sed "s/^/  /"
' || { echo "The restore stopped half-way; the backend stays stopped. The data that was live is in $aside/." >&2; exit 1; }

# 5. Start it and show the balances
echo "Starting the backend..."
$COMPOSE start backend
for i in $(seq 60); do
  if balances=$($COMPOSE exec -T backend node -e "
      fetch('http://localhost:3000/api/users').then(r => r.json())
        .then(us => us.forEach(u => console.log('  ' + u.name + ': ' + u.stars + ' stars')))
        .catch(() => process.exit(1))" 2>/dev/null); then
    echo "Restored from $src. Balances now:"
    echo "$balances"
    echo "The data that was live is in $aside/."
    exit 0
  fi
  sleep 2
done
echo "The backend did not answer within 2 minutes: check '$COMPOSE logs backend'. The data that was live is in $aside/." >&2
exit 1
