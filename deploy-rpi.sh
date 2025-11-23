#!/bin/bash
# Deploy script for Raspberry Pi

set -e

echo "🍓 Deploying to Raspberry Pi..."
echo ""

# Pull latest code
if [ -d .git ]; then
    echo "📦 Pulling latest code..."
    git pull
fi

# Pull pre-built images
echo "🐳 Pulling Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.release.yml pull

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.yml -f docker-compose.release.yml up -d

# Wait for services
sleep 2

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
docker-compose -f docker-compose.yml -f docker-compose.release.yml ps

# Get IP
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🌐 Access at: http://$IP"
