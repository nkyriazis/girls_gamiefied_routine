# LLM Service Quick Start Guide

This guide will help you get the LLM service up and running quickly.

## Step 1: Get API Keys

You need at least one LLM provider API key. OpenAI is recommended because it's required for RAG embeddings.

### OpenAI (Recommended)
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### Anthropic (Optional)
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy the key (starts with `sk-ant-`)

## Step 2: Configure Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key(s):
   ```bash
   # Required for RAG functionality
   OPENAI_API_KEY=sk-proj-your-actual-key-here
   
   # Optional - for Claude models
   ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
   
   # Configuration
   DEFAULT_LLM_PROVIDER=openai
   DEFAULT_MODEL=gpt-4o-mini
   ```

## Step 3: Start the Service

### Development Mode (with hot reload):
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Wait for all services to start. You should see:
```
llm-service_1  | INFO:     Application startup complete.
llm-service_1  | INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Production Mode:
```bash
docker-compose up --build
```

## Step 4: Verify Service is Running

Open your browser or use curl:

```bash
# Check health
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "llm_provider": "openai",
  "llm_available": true,
  "rag_available": true
}
```

## Step 5: Test Exercise Generation

Using curl:
```bash
curl -X POST http://localhost:8000/exercises/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "u1",
    "subject": "mathematics",
    "topic": "addition",
    "difficulty": "easy",
    "num_exercises": 3,
    "exercise_type": "multiple_choice"
  }'
```

Or use the provided example script:
```bash
# From the project root
cd llm-service
python3 example.py
```

## Step 6: Upload a Textbook (Optional)

To enable RAG-based exercise generation:

```bash
# Upload a PDF textbook
curl -X POST http://localhost:8000/documents/upload \
  -F "file=@/path/to/textbook.pdf" \
  -F "subject=mathematics"
```

After uploading textbooks, the exercise generator will automatically use them as context for creating curriculum-aligned exercises.

## Troubleshooting

### "llm_available": false

**Problem**: Service can't connect to LLM provider

**Solutions**:
1. Check your API key is correctly set in `.env`
2. Verify the key is valid (test at provider's website)
3. Check for any typos in the `.env` file
4. Restart the containers: `docker-compose down && docker-compose up`

### Service won't start

**Problem**: Port 8000 already in use

**Solutions**:
1. Stop other services using port 8000
2. Change the port in docker-compose files
3. Use `docker-compose ps` to see what's running

### RAG not working

**Problem**: "rag_available": false

**Solutions**:
1. RAG requires OpenAI API key for embeddings
2. Make sure OPENAI_API_KEY is set in `.env`
3. Check the logs: `docker-compose logs llm-service`

### Poor exercise quality

**Solutions**:
1. Upload relevant textbook PDFs for better context
2. Use gpt-4o instead of gpt-4o-mini for higher quality (costs more)
3. Adjust difficulty level to match user's level
4. Provide more specific topics

## Next Steps

1. **Upload Textbooks**: Upload school textbooks as PDFs for each subject
2. **Integrate with Backend**: Connect the backend to call LLM service APIs
3. **Add UI**: Create frontend components to display exercises
4. **Track Progress**: Store exercise attempts and results
5. **Adapt Difficulty**: Use performance data to adjust difficulty

## API Documentation

Once the service is running, visit:
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Cost Monitoring

Monitor your API usage:
- OpenAI: https://platform.openai.com/usage
- Anthropic: https://console.anthropic.com/settings/usage

**Approximate costs per exercise set (5 questions):**
- gpt-4o-mini: $0.001 - $0.005
- gpt-4o: $0.01 - $0.05
- claude-3-5-sonnet: $0.01 - $0.05

## Support

For issues or questions:
1. Check the logs: `docker-compose logs llm-service`
2. Review the main README: [../llm-service/README.md](README.md)
3. Check the example script: `llm-service/example.py`
