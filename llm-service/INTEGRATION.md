# LLM Service Integration Guide

This document explains how the LLM service integrates with the existing Girls Gamified Routine system.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Girls Gamified Routine                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐      ┌──────────────┐      ┌─────────────┐ │
│  │  Frontend   │─────▶│   Backend    │─────▶│ LLM Service │ │
│  │   (React)   │      │  (Fastify)   │      │  (FastAPI)  │ │
│  │ Port: 5173  │◀─────│  Port: 3000  │◀─────│ Port: 8000  │ │
│  └─────────────┘      └──────────────┘      └─────────────┘ │
│         │                     │                      │        │
│         │                     │                      │        │
│         ▼                     ▼                      ▼        │
│   ┌─────────────────────────────────────────────────────┐   │
│   │            Docker Network: routine-net              │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   External Services    │
                    ├────────────────────────┤
                    │  • OpenAI API          │
                    │  • Anthropic API       │
                    └────────────────────────┘
```

## Service Responsibilities

### Frontend (Existing)
- User interface for routines, tasks, rewards
- **New**: Display generated exercises
- **New**: Upload textbooks interface
- **New**: Exercise completion tracking

### Backend (Existing)
- User management and star tracking
- Routine and task scheduling
- WebSocket for real-time updates
- MCP server for AI integration
- **New**: Proxy requests to LLM service
- **New**: Store exercise history

### LLM Service (New)
- Generate personalized exercises
- Process and store textbook documents
- RAG-based content retrieval
- Chat interface for questions
- Exercise validation and scoring

## Data Flow Examples

### Exercise Generation Flow

```
1. User requests exercises (via Frontend)
   │
   ▼
2. Frontend → Backend (HTTP POST /api/exercises/request)
   {
     "user_id": "u1",
     "subject": "math",
     "topic": "fractions"
   }
   │
   ▼
3. Backend → LLM Service (HTTP POST /exercises/generate)
   {
     "user_id": "u1",
     "subject": "mathematics",
     "topic": "fractions",
     "difficulty": "medium",
     "num_exercises": 5
   }
   │
   ▼
4. LLM Service:
   - Retrieves relevant textbook content (RAG)
   - Generates exercises using LLM
   - Returns structured exercises
   │
   ▼
5. Backend:
   - Stores exercises in database
   - Awards star potential
   - Broadcasts update via WebSocket
   │
   ▼
6. Frontend:
   - Displays exercises to user
   - Tracks completion
   - Shows progress
```

### Textbook Upload Flow

```
1. User uploads textbook PDF (via Frontend)
   │
   ▼
2. Frontend → Backend (HTTP POST /api/textbooks/upload)
   │
   ▼
3. Backend → LLM Service (HTTP POST /documents/upload)
   - Forwards PDF file
   - Adds metadata (subject, grade level)
   │
   ▼
4. LLM Service:
   - Saves PDF to storage
   - Extracts text content
   - Chunks text into segments
   - Creates embeddings
   - Stores in vector database
   │
   ▼
5. Response propagated back to Frontend
   - Shows success message
   - Lists uploaded documents
```

## Integration Points

### 1. Backend → LLM Service API Calls

Add to `backend/src/server.ts`:

```typescript
// Example: Generate exercises endpoint
server.post('/api/exercises/generate', async (request, reply) => {
  const { userId, subject, topic, difficulty } = request.body;
  
  try {
    const response = await fetch('http://llm-service:8000/exercises/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        subject,
        topic,
        difficulty: difficulty || 'medium',
        num_exercises: 5,
        exercise_type: 'multiple_choice'
      })
    });
    
    const data = await response.json();
    
    // Store exercises in state
    // Award potential stars
    // Broadcast via WebSocket
    
    return data;
  } catch (error) {
    reply.status(500).send({ error: 'Failed to generate exercises' });
  }
});
```

### 2. Frontend Exercise Display

Add to `frontend/src/components/`:

```typescript
// ExerciseView.tsx
interface Exercise {
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  points: number;
}

function ExerciseView({ exercises }: { exercises: Exercise[] }) {
  // Display exercises
  // Handle user answers
  // Show feedback
  // Award stars on completion
}
```

### 3. Data Schema Extensions

Add to `backend/data.schema.json`:

```json
{
  "exercises": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "userId": { "type": "string" },
        "subject": { "type": "string" },
        "topic": { "type": "string" },
        "questions": { "type": "array" },
        "status": { "enum": ["pending", "completed", "expired"] },
        "createdAt": { "type": "string" },
        "completedAt": { "type": "string" }
      }
    }
  },
  "textbooks": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "filename": { "type": "string" },
        "subject": { "type": "string" },
        "gradeLevel": { "type": "number" },
        "uploadedAt": { "type": "string" }
      }
    }
  }
}
```

## Environment Variables

### Development
Set in `.env`:
```bash
# LLM Service
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_LLM_PROVIDER=openai
DEFAULT_MODEL=gpt-4o-mini
```

### Production
Use Docker secrets or environment variables in deployment:
```bash
docker compose up -e OPENAI_API_KEY=sk-...
```

## Networking

All services communicate through the `routine-net` Docker network:

- Frontend can call Backend: `http://backend:3000`
- Backend can call LLM Service: `http://llm-service:8000`
- LLM Service is isolated from external direct access (only via Backend)

In production, expose only Frontend (port 80) to the internet.

## Security Considerations

1. **API Keys**: Never commit API keys to git. Use `.env` files (in `.gitignore`)
2. **Service Access**: LLM service should only be accessible via Backend
3. **Rate Limiting**: Implement rate limiting in Backend for exercise generation
4. **Cost Control**: Monitor API usage to prevent unexpected costs
5. **Content Filtering**: Validate user-generated content before sending to LLM

## Future Enhancements

### Phase 1 (Current)
- ✅ LLM service setup
- ✅ Exercise generation API
- ✅ Document upload and RAG
- ✅ Multiple LLM provider support

### Phase 2 (Next Steps)
- [ ] Backend integration endpoints
- [ ] Frontend exercise components
- [ ] Exercise history storage
- [ ] User progress tracking

### Phase 3 (Future)
- [ ] Adaptive difficulty based on performance
- [ ] Multi-language support
- [ ] Exercise templates customization
- [ ] Automated curriculum alignment
- [ ] Parent/teacher dashboard
- [ ] Exercise quality scoring

## Cost Estimates

Based on typical usage:

### Per User Per Day
- Exercise generation: 2-3 sessions × 5 exercises = ~$0.02-0.05
- Chat interactions: ~10 messages = ~$0.01-0.02
- Total: ~$0.03-0.07 per user per day

### Monthly (10 users)
- Exercise generation: 10 users × 30 days × $0.04 = ~$12
- Chat: 10 users × 30 days × $0.015 = ~$4.50
- Total: ~$16.50/month

*Using gpt-4o-mini. Costs with gpt-4o would be 10-20x higher.*

## Monitoring

### Service Health
```bash
# Check all services
docker compose ps

# Check LLM service logs
docker compose logs -f llm-service

# Check health endpoint
curl http://localhost:8000/health
```

### API Usage
- OpenAI: https://platform.openai.com/usage
- Anthropic: https://console.anthropic.com/settings/usage

## Troubleshooting

### Service won't start
1. Check Docker logs: `docker compose logs llm-service`
2. Verify requirements.txt is complete
3. Check port 8000 is not in use

### LLM not available
1. Verify API key in `.env`
2. Test API key at provider's website
3. Check for rate limits or quota issues

### RAG not working
1. Requires OpenAI API key (for embeddings)
2. Check vectordb directory permissions
3. Verify documents uploaded successfully

### Poor exercise quality
1. Upload relevant textbook PDFs
2. Use more specific topics
3. Try gpt-4o for better quality
4. Adjust difficulty level

## Support Resources

- [LLM Service README](README.md)
- [Quick Start Guide](QUICKSTART.md)
- [Example Usage](example.py)
- [Health Check](health_check.sh)
- [OpenAI Docs](https://platform.openai.com/docs)
- [Anthropic Docs](https://docs.anthropic.com/)
