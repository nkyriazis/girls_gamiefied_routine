#!/bin/bash
# Deploy script for the Raspberry Pi (piserve): ./deploy-rpi.sh, in the checkout.
#
# The family's data lives in backend/ and git never touches it: data.json and exercises.json are
# git-ignored (each install has its own; the backend creates them from backend/*.example.json only
# on a database with no history), like routine.db, uploads/ and backups/.
#
# The order keeps the site up when a deploy fails:
#   1. git fetch, then refuse if the incoming commits touch backend/data.json or exercises.json
#      (git would overwrite or delete the live file, ignored or not)
#   2. git merge --ff-only: refused on local edits to tracked files or local commits
#   3. pull the images while the site runs; the image the running container uses is kept as :previous
#   4. only then stop the backend, back up the data to backups/<date>/, and start everything
# If something fails between the stop and `up -d` (the backup), the trap starts the backend again:
# the same container, the old image. A failure inside `up -d` may come after compose replaced the
# old container, so starting "the backend" may start the new, broken one: the way back is the
# rollback, which the script prints whenever the pull brought new images, on success and on failure.
# Rolling back is image-only. Never `git checkout` an older commit here: it would overwrite or
# delete the ignored live files (see CLAUDE.md, "Deployment target").

set -euo pipefail

COMPOSE="docker-compose -f docker-compose.yml -f docker-compose.release.yml"
REGISTRY="ghcr.io/nkyriazis"
LIVE_CONFIG="backend/data.json backend/exercises.json"
ROLLBACK=""     # the docker tag lines that put the images that ran back on :latest (set in step 3)
BACKUP_DIR=""   # this deploy's backup (set in step 4)
STARTING=""     # set once `up -d` runs: from then on the old backend container may be gone

# The image a service's container runs (or ran, when stopped); empty when there is none
running_image() {
    local id
    id=$($COMPOSE ps -a -q "$1" 2>/dev/null | head -n1 || true)   # -a: a stopped one counts
    [ -n "$id" ] && docker inspect --format '{{.Image}}' "$id" 2>/dev/null || true
}

# The way back to the images that ran before this deploy, when the pull brought new ones
print_rollback() {
    [ -n "$ROLLBACK" ] || return 0
    echo ""
    echo "↩️  To roll back to the images that ran before this deploy:"
    echo -n "$ROLLBACK"
    echo "   $COMPOSE up -d"
    echo "   (If this release changed the database, stop the backend and restore routine.db from $BACKUP_DIR first.)"
}

# Run by the EXIT trap once the backend is stopped. Before `up -d` the backend is still the old
# container, and starting it puts the site back. Inside `up -d` compose may already have replaced it
# with the new image's container: then only the rollback below brings the old image back.
restart_backend() {
    local code=$1
    [ "$code" -eq 0 ] && return
    echo ""
    echo "⚠️  The deploy failed (exit $code) after stopping the backend: starting it again..."
    $COMPOSE start backend || echo "⛔ The backend did not start."
    if [ -n "$STARTING" ] && [ -n "$ROLLBACK" ]; then
        echo "   It failed while starting the services: the backend may now be the new image's container"
        echo "   (running and broken, or not running). Check with $COMPOSE ps, and roll back."
    fi
    print_rollback
}

main() {
    echo "🍓 Deploying to Raspberry Pi..."
    echo ""

    # 1-2. The code, before anything is stopped
    if [ -d .git ]; then
        echo "📦 Fetching the latest code..."
        git fetch --quiet
        local incoming
        # shellcheck disable=SC2086
        incoming=$(git log --format='%h %s' 'HEAD..@{u}' -- $LIVE_CONFIG)
        if [ -n "$incoming" ]; then
            echo "⛔ The incoming commits touch the live config ($LIVE_CONFIG):"
            echo "$incoming" | sed 's/^/     /'
            echo "   Pulling them would overwrite or delete the family's file. Nothing was stopped:"
            echo "   the site is still up. See \"Deployment target\" in CLAUDE.md."
            exit 1
        fi
        echo "📦 Updating the code: $(git rev-parse --short HEAD) → $(git rev-parse --short '@{u}')"
        if ! git merge --ff-only '@{u}'; then
            echo "⛔ git could not fast-forward (local edits to tracked files, or local commits)."
            echo "   Nothing was stopped: the site is still up. See what is in the way with"
            echo "   git status -sb; git log --oneline @{u}..HEAD"
            exit 1
        fi
    fi

    # 3. The images, while the site runs
    echo "🐳 Pulling Docker images (the site keeps running)..."
    local before_backend before_frontend
    before_backend=$(running_image backend)
    before_frontend=$(running_image frontend)
    if ! $COMPOSE pull; then
        echo "⛔ Pulling the images failed. Nothing was stopped: the site is still up, on its images."
        exit 1
    fi
    for pair in "backend:$before_backend" "frontend:$before_frontend"; do
        local service=${pair%%:*} image=${pair#*:} repo="$REGISTRY/routine-${pair%%:*}" latest
        latest=$(docker image inspect --format '{{.Id}}' "$repo:latest" 2>/dev/null || true)
        if [ -z "$image" ]; then
            echo "   $service: no container ran before ($COMPOSE ps -a -q $service printed none), so no :previous"
        elif [ "$image" = "$latest" ]; then
            echo "   $service: no new image (:previous left as it was)"
        else
            docker tag "$image" "$repo:previous"
            echo "   $service: the image that ran (${image#sha256:}) is now $repo:previous"
            ROLLBACK+="   docker tag $repo:previous $repo:latest && \\"$'\n'
        fi
    done

    # 4. Stop the backend for a consistent backup (on a clean stop SQLite folds its WAL back
    # into routine.db), then start everything
    BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
    echo "💾 Backing up data to $BACKUP_DIR..."
    trap 'restart_backend $?' EXIT
    $COMPOSE stop backend
    mkdir -p "$BACKUP_DIR"
    for f in data.json exercises.json routine.db routine.db-wal state.json logs.jsonl; do
        if [ -f "backend/$f" ]; then cp --preserve=timestamps "backend/$f" "$BACKUP_DIR/"; fi
    done
    (cd "$BACKUP_DIR" && sha256sum -- * > SHA256SUMS 2>/dev/null || true)

    # Ensure uploads directory exists with correct permissions
    echo "📁 Ensuring uploads directory exists..."
    mkdir -p backend/uploads
    chmod 755 backend/uploads 2>/dev/null || true  # may be owned by root (created by the container)

    echo "🚀 Starting services..."
    STARTING=1
    $COMPOSE up -d
    trap - EXIT

    # Wait for services
    sleep 2

    echo ""
    echo "✅ Deployment complete!"
    echo ""
    $COMPOSE ps

    local ip
    ip=$(hostname -I | awk '{print $1}')
    echo ""
    echo "🌐 Access at: http://$ip"
    print_rollback
}

# The whole script is read before it runs, so a pull that changes it can't change it mid-run
main "$@"
exit
