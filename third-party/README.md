# Third-Party Dependencies

This directory contains references to third-party projects for reference and inspiration.

## Danswer/Onyx

**Repository:** https://github.com/unoplat/danswer

**Purpose:** Reference implementation for enterprise RAG (Retrieval-Augmented Generation) and semantic search.

**Usage in this project:**
- Our custom `llm-service` is inspired by Danswer's architecture
- We use similar technologies: LangChain, FastAPI, vector embeddings
- This submodule provides reference documentation and code examples

**Why not use Danswer directly?**

Danswer is a comprehensive enterprise search platform requiring:
- PostgreSQL database
- Redis cache
- Vespa vector search engine
- Nginx reverse proxy
- Multiple background workers
- 8+ Docker containers total

Our use case is more focused (exercise generation from textbooks), so we implemented a lightweight service (1 container) using the same architectural patterns.

**When to consider Danswer:**

If your requirements grow to include:
- Enterprise search across multiple data sources (Slack, Google Drive, Confluence, etc.)
- Multi-user authentication and permissions
- Advanced admin dashboard
- Automatic connector syncing
- Large-scale deployment

Then migrating to full Danswer would be appropriate. See `../DANSWER_INTEGRATION_OPTIONS.md` for migration guidance.

## Cloning with Submodules

To get this repository with all submodules:

```bash
# Initial clone
git clone --recursive https://github.com/nkyriazis/girls_gamiefied_routine.git

# Or if already cloned
git submodule update --init --recursive
```

## Updating Submodules

```bash
# Update Danswer to latest version
git submodule update --remote third-party/danswer
```

## License

Danswer is licensed under MIT License. See `danswer/LICENSE` for details.
