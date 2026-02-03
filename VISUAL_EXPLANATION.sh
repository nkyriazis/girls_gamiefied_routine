#!/bin/bash
# Visual representation of what runs vs what's for reference

cat << 'EOF'

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     WHAT ACTUALLY RUNS vs WHAT'S JUST FOR REFERENCE          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  WHEN YOU RUN: docker compose up                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

    ╔═══════════════════════════════════════════════════════╗
    ║           🟢 SERVICES THAT START & RUN                ║
    ╚═══════════════════════════════════════════════════════╝

    ┌──────────────────┐
    │   Frontend       │  Port 5173
    │   (React)        │  ← From frontend/
    └──────────────────┘

    ┌──────────────────┐
    │   Backend        │  Port 3000
    │   (Fastify)      │  ← From backend/
    └──────────────────┘

    ┌──────────────────┐
    │   LLM Service    │  Port 8000
    │   (FastAPI)      │  ← From llm-service/ ⭐ YOUR CUSTOM CODE
    └──────────────────┘

    These 3 services are ACTIVE and RUNNING


    ╔═══════════════════════════════════════════════════════╗
    ║        📚 CODE THAT DOES NOT RUN                      ║
    ╚═══════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────┐
    │   third-party/danswer/                   │
    │   (Git Submodule)                        │
    │                                          │
    │   Full Danswer source code               │
    │   Just for reading & reference           │
    │   NOT in docker-compose                  │
    │   Does NOT start                         │
    └──────────────────────────────────────────┘

    This is REFERENCE ONLY - like a textbook


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  DIRECTORY STRUCTURE                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Repository Root/
│
├── frontend/              🟢 RUNS (React app)
│
├── backend/               🟢 RUNS (Fastify API)
│
├── llm-service/           🟢 RUNS (Your custom FastAPI)
│   ├── src/
│   │   ├── main.py             ← Your API endpoints
│   │   ├── llm_manager.py      ← Your LLM logic
│   │   ├── rag_manager.py      ← Your RAG logic
│   │   └── exercise_generator.py
│   ├── Dockerfile              ← Builds YOUR container
│   └── requirements.txt        ← YOUR dependencies
│
└── third-party/           📚 REFERENCE ONLY
    └── danswer/                ← Danswer's source code
        └── (doesn't run)       ← Just for learning


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  WHAT EACH DIRECTORY CONTAINS                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

llm-service/              third-party/danswer/
─────────────────────────────────────────────────────────────
Size: 116 KB             Size: ~20 MB (in .git)
Files: ~12               Files: Thousands
Lines: ~500              Lines: ~50,000+
Purpose: RUN THIS        Purpose: READ THIS
Docker: YES              Docker: NO
Active: YES              Active: NO
Custom: YES              Reference: YES


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ANALOGY                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

llm-service/
    = Your bicycle that you ride daily
    ✓ Lightweight
    ✓ Works for your needs
    ✓ You maintain it

third-party/danswer/
    = Factory manual for building bicycles
    ✓ Shows how pros do it
    ✓ Reference for learning
    ✓ Don't need to use it unless you want to build a factory


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  DOCKER COMPOSE CONFIGURATION                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

# docker-compose.yml
services:
  backend:
    build: backend/      # ← Builds & runs

  frontend:
    build: frontend/     # ← Builds & runs

  llm-service:
    build: llm-service/  # ← Builds & runs ⭐ YOUR CODE

  # NOTE: No danswer service here!
  # The submodule is just files, not a service


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  VERIFICATION COMMANDS                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

# Start services
docker compose up

# Check what's running
docker compose ps
# Output shows:
#   ✓ backend
#   ✓ frontend
#   ✓ llm-service
#   ✗ NO danswer, postgres, redis, etc.

# Test YOUR custom service
curl http://localhost:8000/health
# This hits llm-service/src/main.py

# Browse Danswer reference (doesn't run anything)
cd third-party/danswer
ls -la
# Just reading code, not running it


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SUMMARY                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

✅ YES - You kept custom implementation (llm-service/)
   → This is ACTIVE and RUNS

✅ YES - You added Danswer as submodule (third-party/danswer/)
   → This is REFERENCE ONLY, doesn't run

🎯 RESULT: You have a working service + reference manual

👍 CORRECT: Your understanding is 100% accurate!


┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  WHY THIS MAKES SENSE                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Your Requirements:
  ✓ Generate exercises from textbooks
  ✓ Simple, focused solution
  ✓ Integrate with existing 2-service system

Custom Service Provides:
  ✓ Exercise generation API
  ✓ RAG with ChromaDB
  ✓ LLM integration
  ✓ 1 container, easy to maintain

Danswer Submodule Provides:
  ✓ Reference implementation
  ✓ Learn from production code
  ✓ Migration path if needs grow
  ✓ Best practices for RAG

Both Together:
  ✓ Working solution NOW
  ✓ Learning resource ALWAYS
  ✓ Migration option LATER


EOF
