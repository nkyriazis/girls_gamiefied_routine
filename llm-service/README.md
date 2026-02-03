# LLM Service

A dedicated microservice for LLM (Large Language Model) and RAG (Retrieval-Augmented Generation) functionality, designed to generate personalized exercises based on school textbooks.

## Relationship with Danswer/Onyx

This service is **inspired by [Danswer](https://github.com/unoplat/danswer)** (now Onyx) but intentionally lightweight for focused use case.

**Why not use Danswer directly?**
- Danswer is a full enterprise search platform (8+ containers: PostgreSQL, Redis, Vespa, Nginx, workers, etc.)
- This system currently has 2 core services; adding Danswer would mean 10+ services
- Our use case: Generate exercises from textbooks (focused)
- Danswer's use case: Enterprise search across Slack/Google Drive/Confluence/etc. (broad)

**What we use from Danswer's approach:**
- ✅ RAG architecture pattern
- ✅ LangChain framework (same as Danswer)
- ✅ Vector embeddings for semantic search
- ✅ FastAPI backend (same as Danswer)

**Danswer reference:** See `third-party/danswer/` submodule for the full implementation.

**When to switch to Danswer:** If you need multi-user enterprise search, Slack integration, or 10+ data connectors, consider migrating to full Danswer stack. See `DANSWER_INTEGRATION_OPTIONS.md` for details.

---

## Features

- **Multiple LLM Providers**: Support for OpenAI (GPT-4, GPT-3.5) and Anthropic (Claude)
- **RAG (Retrieval-Augmented Generation)**: Upload textbooks and documents for context-aware exercise generation
- **Exercise Generation**: Create personalized exercises in multiple formats:
  - Multiple choice questions
  - Short answer questions
  - Problem-solving exercises
  - Essay prompts
- **Vector Database**: Uses ChromaDB for efficient document retrieval
- **Document Processing**: PDF processing and text chunking for optimal RAG performance

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐     ┌──────────────────┐
│   Backend       │────▶│   LLM Service    │
│   (Fastify)     │     │   (FastAPI)      │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌─────────┐ ┌──────────┐
              │  OpenAI  │ │ Claude  │ │ ChromaDB │
              │   API    │ │   API   │ │ (Vector) │
              └──────────┘ └─────────┘ └──────────┘
```

## Setup

### 1. Get API Keys

You'll need at least one LLM provider API key:

**OpenAI** (Recommended for RAG - provides embeddings)
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env` as `OPENAI_API_KEY`

**Anthropic** (Optional - for Claude models)
1. Go to https://console.anthropic.com/
2. Create an API key
3. Add to `.env` as `ANTHROPIC_API_KEY`

### 2. Configure Environment

Copy `.env.example` to `.env` and add your API keys:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_LLM_PROVIDER=openai
DEFAULT_MODEL=gpt-4o-mini
```

### 3. Start the Service

**Development Mode** (with hot reload):
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Production Mode**:
```bash
docker-compose up
```

The LLM service will be available at:
- Development: http://localhost:8000
- Production: http://localhost:8000

## API Endpoints

### Health Check
```bash
GET /health
```

Returns service status and availability of LLM and RAG systems.

### Generate Exercises
```bash
POST /exercises/generate
Content-Type: application/json

{
  "user_id": "u1",
  "subject": "mathematics",
  "topic": "fractions",
  "difficulty": "medium",
  "num_exercises": 5,
  "exercise_type": "multiple_choice"
}
```

**Response:**
```json
{
  "exercises": [
    {
      "question": "What is 1/2 + 1/4?",
      "options": ["1/6", "2/6", "3/4", "1/3"],
      "correct_answer": "C",
      "explanation": "To add fractions, find common denominator...",
      "difficulty": "medium",
      "points": 10
    }
  ],
  "metadata": {
    "user_id": "u1",
    "subject": "mathematics",
    "topic": "fractions",
    "difficulty": "medium",
    "exercise_type": "multiple_choice",
    "count": 5
  }
}
```

### Upload Document (Textbook)
```bash
POST /documents/upload
Content-Type: multipart/form-data

file: textbook.pdf
subject: mathematics
```

**Response:**
```json
{
  "filename": "textbook.pdf",
  "document_id": "abc123...",
  "status": "success",
  "chunks_created": 245
}
```

### List Documents
```bash
GET /documents/list
```

Returns all uploaded documents with metadata.

### Delete Document
```bash
DELETE /documents/{document_id}
```

Removes a document and its embeddings from the system.

### Chat (with optional RAG)
```bash
POST /chat
Content-Type: application/json

{
  "message": "Explain fractions to a 10-year-old",
  "user_id": "u1",
  "use_rag": true
}
```

## Exercise Types

### Multiple Choice
- 4 options (A, B, C, D)
- One correct answer
- Explanation provided
- Best for: facts, concepts, definitions

### Short Answer
- Open-ended text response
- Expected answer provided
- Grading guidance included
- Best for: comprehension, recall

### Problem Solving
- Mathematical or logical problems
- Step-by-step solution
- Shows working process
- Best for: math, science, logic

### Essay
- Extended writing prompt
- Key points to cover
- Grading rubric
- Best for: analysis, creative writing

## Difficulty Levels

- **Easy**: Beginner level, simple concepts (5-10 stars)
- **Medium**: Intermediate level, core concepts (10-15 stars)
- **Hard**: Advanced level, deep understanding (15-25 stars)

## RAG Workflow

1. **Upload Textbooks**: Upload PDF textbooks via `/documents/upload`
2. **Processing**: System chunks the document and creates embeddings
3. **Storage**: Embeddings stored in ChromaDB vector database
4. **Generation**: When generating exercises, relevant chunks are retrieved
5. **Context**: LLM uses retrieved content to create accurate, curriculum-aligned exercises

## Data Persistence

Documents and vector database are persisted in:
```
llm-service/data/
├── documents/     # Uploaded PDF files
└── vectordb/      # ChromaDB vector database
```

Mount this directory in production to preserve data across container restarts.

## Integration with Backend

The LLM service can be called from the main backend:

```typescript
// Example backend integration
const response = await fetch('http://llm-service:8000/exercises/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    subject: 'mathematics',
    topic: 'addition',
    difficulty: 'easy',
    num_exercises: 5
  })
});

const data = await response.json();
```

## Cost Considerations

### OpenAI (gpt-4o-mini)
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens
- Embeddings: ~$0.02 per 1M tokens
- **Estimated cost per exercise set**: $0.001-0.01

### Anthropic (Claude 3.5 Sonnet)
- Input: ~$3 per 1M tokens
- Output: ~$15 per 1M tokens
- **Estimated cost per exercise set**: $0.01-0.05

*Costs are estimates. Monitor usage in your provider dashboard.*

## Troubleshooting

### Service not starting
```bash
# Check logs
docker-compose logs llm-service

# Common issues:
# - Missing API keys
# - Port 8000 already in use
# - Python dependencies failed to install
```

### RAG not working
- Ensure OpenAI API key is set (needed for embeddings)
- Check if documents are uploaded: `curl http://localhost:8000/documents/list`
- Verify ChromaDB directory has write permissions

### Poor exercise quality
- Upload relevant textbook PDFs for better context
- Adjust difficulty level appropriately
- Try different LLM models (gpt-4o for better quality)
- Increase context in RAG (modify `top_k_retrieval` in config)

## Future Enhancements

- [ ] Support for more document formats (DOCX, TXT, HTML)
- [ ] Multi-language support
- [ ] Fine-tuned models for specific subjects
- [ ] Exercise difficulty adaptation based on user performance
- [ ] Integration with user progress tracking
- [ ] Automated curriculum alignment checking
- [ ] Exercise quality scoring and validation

## Security Notes

- API keys are sensitive - never commit to git
- In production, use secrets management (Docker secrets, Kubernetes secrets)
- Consider rate limiting for the API endpoints
- Monitor API costs in your LLM provider dashboard

## References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [LangChain Documentation](https://python.langchain.com/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Danswer - RAG Reference](https://github.com/danswer-ai/danswer)
