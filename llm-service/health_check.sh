#!/bin/bash
# Health check script for LLM service

echo "========================================"
echo "LLM Service Health Check"
echo "========================================"
echo ""

# Check if service is running
echo "1. Checking if service is accessible..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ | grep -q "200"; then
    echo "   ✓ Service is running"
else
    echo "   ✗ Service is not accessible at http://localhost:8000"
    echo "   Run: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up"
    exit 1
fi

echo ""
echo "2. Checking service health..."
HEALTH=$(curl -s http://localhost:8000/health)

if [ $? -eq 0 ]; then
    echo "   ✓ Health endpoint responded"
    
    # Parse JSON response (requires jq, but works without it too)
    if command -v jq &> /dev/null; then
        STATUS=$(echo $HEALTH | jq -r '.status')
        LLM_PROVIDER=$(echo $HEALTH | jq -r '.llm_provider')
        LLM_AVAILABLE=$(echo $HEALTH | jq -r '.llm_available')
        RAG_AVAILABLE=$(echo $HEALTH | jq -r '.rag_available')
        
        echo "   Status: $STATUS"
        echo "   LLM Provider: $LLM_PROVIDER"
        echo "   LLM Available: $LLM_AVAILABLE"
        echo "   RAG Available: $RAG_AVAILABLE"
        
        if [ "$LLM_AVAILABLE" = "false" ]; then
            echo ""
            echo "   ⚠️  Warning: LLM not available"
            echo "   Please check your API keys in .env file"
        fi
        
        if [ "$RAG_AVAILABLE" = "false" ]; then
            echo ""
            echo "   ⚠️  Warning: RAG not available"
            echo "   Please set OPENAI_API_KEY in .env file for RAG functionality"
        fi
    else
        echo "$HEALTH" | python3 -m json.tool
    fi
else
    echo "   ✗ Failed to get health status"
    exit 1
fi

echo ""
echo "3. Checking available endpoints..."
ENDPOINTS=(
    "/"
    "/health"
    "/docs"
)

for endpoint in "${ENDPOINTS[@]}"; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000$endpoint")
    if [ "$CODE" = "200" ]; then
        echo "   ✓ $endpoint (HTTP $CODE)"
    else
        echo "   ✗ $endpoint (HTTP $CODE)"
    fi
done

echo ""
echo "========================================"
echo "✨ Health check complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  - View API docs: http://localhost:8000/docs"
echo "  - Run example: cd llm-service && python3 example.py"
echo "  - Read guide: llm-service/QUICKSTART.md"
echo ""
