#!/bin/bash
# Deploy script for Raspberry Pi

set -e

echo "🍓 Deploying to Raspberry Pi..."
echo ""

COMPOSE="docker-compose -f docker-compose.yml -f docker-compose.release.yml"

# Back up the live data before anything else. The backend is stopped first so
# the database copy is consistent (on a clean stop SQLite folds its WAL back
# into routine.db).
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
echo "💾 Backing up data to $BACKUP_DIR..."
$COMPOSE stop backend 2>/dev/null || true
mkdir -p "$BACKUP_DIR"
for f in data.json exercises.json routine.db routine.db-wal state.json logs.jsonl; do
    if [ -f "backend/$f" ]; then cp --preserve=timestamps "backend/$f" "$BACKUP_DIR/"; fi
done
(cd "$BACKUP_DIR" && sha256sum * > SHA256SUMS 2>/dev/null || true)

# Pull latest code
if [ -d .git ]; then
    echo "📦 Pulling latest code..."
    git pull
fi

# Ensure uploads directory exists with correct permissions
echo "📁 Ensuring uploads directory exists..."
mkdir -p backend/uploads
chmod 755 backend/uploads

# Pull pre-built images
echo "🐳 Pulling Docker images..."
$COMPOSE pull

# Start services
echo "🚀 Starting services..."
$COMPOSE up -d

# Wait for services
sleep 2

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
$COMPOSE ps

# Get IP
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🌐 Access at: http://$IP"
