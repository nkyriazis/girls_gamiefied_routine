#!/bin/bash
# Trigger GitHub Actions build using Docker

TOKEN="${GITHUB_TOKEN}"

echo "🚀 Triggering GitHub Actions build..."
echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ GitHub token required"
    echo ""
    echo "Create a token at: https://github.com/settings/tokens/new?scopes=repo,workflow"
    echo ""
    echo "Then set it:"
    echo "  export GITHUB_TOKEN='your_token_here'"
    echo ""
    echo "Or save permanently (add to ~/.bashrc):"
    echo "  echo 'export GITHUB_TOKEN=\"your_token\"' >> ~/.bashrc"
    exit 1
fi

echo "Triggering workflow via GitHub API..."

docker run --rm curlimages/curl:latest \
    curl -X POST \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Authorization: Bearer $TOKEN" \
    -f -s \
    "https://api.github.com/repos/nkyriazis/girls_gamiefied_routine/actions/workflows/docker-build.yml/dispatches" \
    -d '{"ref":"master"}'

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build triggered successfully!"
    echo ""
    echo "📊 View progress at:"
    echo "   https://github.com/nkyriazis/girls_gamiefied_routine/actions"
else
    echo ""
    echo "❌ Failed to trigger build"
    exit 1
fi
