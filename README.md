# QuickDesk

An internal helpdesk with employee tickets, agent replies, and AI assistance grounded in a small knowledge base.

## Current status

Initial setup only: React/TypeScript frontend with Tailwind, FastAPI health endpoint,
PostgreSQL Compose configuration, and environment configuration for MongoDB Atlas
Vector Search. Authentication, persistence, migrations, seed users, RAG ingestion,
ticket workflows, SSE, and metrics are not implemented yet. OpenAI is the selected
provider for generation and embeddings. The health endpoint checks process
liveness, not dependencies.

## Run locally

Prerequisites: Node.js 22.12+ (or a compatible newer version), Python 3.11+,
and a PostgreSQL database (Neon or local Docker). Docker Desktop with Linux
containers is only required for the local option. Commands below use PowerShell.

From the repository root:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```

For Neon, put the connection URL in `backend/.env` as `DATABASE_URL`, keeping
its TLS parameters. Standard `postgresql://` URLs are automatically mapped to
the installed psycopg driver. Skip Docker and the root `.env` for this option.

For local PostgreSQL, set a password in `.env` and the matching password in
`backend/.env`'s `DATABASE_URL` (URL-encode special characters in the URL).
Set `JWT_SECRET` to a random value using the command in the environment example.
Environment files are ignored by Git. Never commit credentials.

```powershell
# Local PostgreSQL only; skip this command when using Neon:
docker compose up -d postgres
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
```

Start the backend in one terminal:

```powershell
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. API documentation: http://localhost:8000/docs.
The frontend proxies `/api` to FastAPI during development. Both processes can
start before the databases are available; this does not verify persistence.
The Python lock file captures the installed dependency versions; the shorter
`requirements.txt` records direct dependency constraints for future updates.

## Storage and planned RAG

PostgreSQL will hold users, tickets, replies, and audit logs. MongoDB Atlas will
hold article chunks, embeddings, and source metadata for citations.

Configure `MONGODB_URI` using an Atlas database user with access to the intended
database and permit the development machine in Atlas network access. Do not
share the URI in chat or commit it. Select an embedding model before creating
the vector index, because the index dimensions must match that model.

```text
React → FastAPI → PostgreSQL (application records)
               → LangChain → MongoDB Atlas Vector Search (knowledge retrieval)
                           → LLM (grounded draft)
```

## Checks

From `backend`, check database connectivity without printing credentials:

```powershell
.venv/Scripts/python.exe -m app.check_services
```

Add `--openai` to also send one short generation request and one embedding
request using synthetic input. These requests may incur API charges. The check
reports embedding dimensions but does not create or validate a vector index.
Set both API key fields in `backend/.env`; they may use the same OpenAI key.
The examples use `gpt-5-mini` and `text-embedding-3-small` (1536 dimensions).

```powershell
cd frontend
npm run build
```

`GET /api/health` is public and returns `{"status":"ok","service":"quickdesk-api"}`.
The remaining endpoint table, architecture decisions, seed instructions, and
demo walkthrough will be documented as features are implemented.
