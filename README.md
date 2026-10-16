# QuickDesk

QuickDesk is an internal helpdesk where employees submit requests and support agents resolve them. OpenAI suggests categories and priorities, while a LangChain RAG pipeline retrieves company knowledge-base passages from an in-memory vector index to draft cited replies. Agents review and edit every reply before sending it. Original AI drafts, final replies, and category/priority overrides are retained separately.

## Run locally

Requirements: Python 3.11+ (tested on 3.13), Node.js 22.12+ or compatible newer release (tested on 26), a PostgreSQL database, and an OpenAI API key with model access and quota. Commands below use PowerShell from the repository root.

> **AI provider support:** This implementation supports **OpenAI only** for both chat generation and embeddings. `LLM_PROVIDER` must remain `openai`. Changing that environment value does not enable Gemini, Anthropic, Ollama, or another provider; supporting one would require a provider adapter and its LangChain integration.

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
Copy-Item backend/.env.example backend/.env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Skip the copy if your `.env` already exists. The final command prints a JWT signing secret; it does not edit the environment file. Copy its complete output into `backend/.env`, then configure the database, OpenAI credentials, and seed password:

```dotenv
JWT_SECRET=paste-the-generated-value-here
SEED_PASSWORD=choose-a-demo-password-of-at-least-12-characters
```

Keep `JWT_SECRET` stable between backend restarts. Replacing it invalidates existing session cookies, so all users must sign in again. `SEED_PASSWORD` must contain at least 12 characters and becomes the shared login password for the sample accounts.

After saving `backend/.env`, initialize and start the backend in the first terminal:

```powershell
cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m app.seed
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The seed command assigns this password to all three sample accounts and prints their login credentials when it finishes. If the accounts already exist, rerunning the command updates them to the current `SEED_PASSWORD` value.

Install and start the frontend in a second terminal:

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open [QuickDesk](http://127.0.0.1:5173) and [API documentation](http://127.0.0.1:8000/docs).

| Seed account | Role |
| --- | --- |
| `agent@quickdesk.test` | Agent |
| `employee@quickdesk.test` | Employee |
| `employee2@quickdesk.test` | Second employee for isolation checks |

All seeded accounts use `SEED_PASSWORD` from your backend environment. The seed command prints the ready-to-use account emails and shared password when it finishes. Rerunning it synchronizes the three demo accounts to the currently configured password, so the displayed credentials always work. There is no public registration or password-reset flow in this assessment scope.

At backend startup, QuickDesk reads the six fictional Markdown articles, splits them, creates OpenAI embeddings, and builds a process-local LangChain `InMemoryVectorStore`. No separate ingestion command or vector database is required. Startup logs the loaded chunk count, and `/api/health` reports whether the index is ready. If ingestion fails, the manual helpdesk remains available and AI draft requests return a service-unavailable response. Restart the backend after changing an article or the embedding model.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection URL for a local or hosted PostgreSQL database; `postgresql://` is accepted and mapped to psycopg |
| `JWT_SECRET` | Stable server-side key used to sign authentication tokens; generate it using the setup command above |
| `SEED_PASSWORD` | Shared password for the three sample users; it must contain at least 12 characters and be set before running the seed command |
| `LLM_PROVIDER` | Must be `openai`; other providers are not implemented |
| `LLM_MODEL` | OpenAI chat model with structured-output support; default setup uses `gpt-5-mini` |
| `LLM_API_KEY` | OpenAI API key used for classification and reply generation |
| `EMBEDDING_MODEL` | OpenAI embedding model; default setup uses `text-embedding-3-small` |
| `EMBEDDING_API_KEY` | OpenAI API key used for embeddings; it may be the same as `LLM_API_KEY` |
| `RAG_MIN_SCORE` | Optional cosine-similarity threshold for retrieved chunks; default `0.35` |
| `FRONTEND_ORIGIN` | `http://localhost:5173`; the same-port `127.0.0.1` alias is also accepted in development |
| `APP_ENV` | `development`; `production` enables Secure session cookies |

Environment files, virtual environments, build output, and local credentials are ignored by Git. Never put API keys in frontend variables.

## Architecture

The backend package is organized by responsibility:

```text
backend/app/
├── api/
│   ├── dependencies.py    # shared authentication and role checks
│   ├── router.py          # top-level router assembly
│   └── routes/            # authentication, tickets, and SSE endpoints
├── core/                  # application settings and security primitives
├── db/                    # SQLAlchemy session and persistence models
├── schemas/               # auth, ticket, and structured AI contracts
├── services/              # OpenAI classification and in-memory RAG
├── scripts/               # seed, health-check, and live smoke commands
├── main.py                # FastAPI application and startup lifecycle
└── seed.py                # compatibility entry point for python -m app.seed
```

```mermaid
flowchart LR
  R[React + TypeScript] -->|HTTP + HttpOnly JWT cookie| F[FastAPI]
  F -->|Users, sessions, tickets, drafts, audit, events| P[(Neon PostgreSQL)]
  P -->|Scoped events via SSE| R
  F --> C[LangChain classifier]
  C --> O[OpenAI gpt-5-mini]
  F --> G[LangChain grounded reply]
  G -->|Embed query| E[OpenAI embeddings]
  G -->|Retrieve top 3 passages| M[(LangChain in-memory vector store)]
  G --> O
  K[Markdown articles] --> I[FastAPI startup ingestion]
  I --> E
  I --> M
```

PostgreSQL is the system of record. Knowledge chunks and vectors live only in each backend process and are rebuilt at startup. Sending a reply and writing the resolution event happen in one transaction. A row lock prevents a second agent from overwriting a resolved ticket. The agent API returns draft history and audit events; employee responses exclude internal drafts and audit details.

## API endpoints

All paths are under `/api`. Mutations after login require the `X-CSRF-Token` returned by login or `/auth/me`.

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/health` | Process liveness and in-memory knowledge-index state | Public |
| POST | `/auth/login` | Sign in; set JWT cookie; return user and CSRF token | Public; origin checked |
| GET | `/auth/me` | Current user and CSRF token | Signed in |
| POST | `/auth/logout` | Revoke server session and clear cookie | Signed in |
| GET | `/tickets` | Search title; filter status/category/priority; 20-row pages | Employee's own or all for agents |
| POST | `/tickets` | Classify and create a ticket | Employee |
| GET | `/tickets/{id}` | Ticket details and final reply | Owner or agent |
| PATCH | `/tickets/{id}` | Update category/priority and audit changes | Agent |
| POST | `/tickets/{id}/drafts` | Retrieve articles and save an immutable AI draft | Agent |
| POST | `/tickets/{id}/reply` | Store final reply and resolve atomically | Agent |
| GET | `/metrics` | Counts, median resolution time, category override rate | Agent |
| GET | `/events` | Authenticated, role-scoped SSE notifications | Signed in |

## Design decisions and assessment questions

### Why did you pick React rather than Next.js?

I chose React with Vite because QuickDesk is an authenticated internal application. It does not require SEO, server-side rendering, or publicly indexed pages, so a client-rendered SPA keeps the architecture simple. React Query owns API data and invalidation, while local component state owns unsent replies. Tailwind CSS provides the styling.

I would consider Next.js if the application later required server-rendered public pages, SEO, server components, or frontend server routes. Being externally accessible would not, by itself, require Next.js.

### How did you structure the RAG pipeline?

At application startup, Markdown files from the knowledge base are loaded and split using LangChain's `RecursiveCharacterTextSplitter`, with a chunk size of 1,200 characters and an overlap of 200 characters. The six knowledge-base documents are currently shorter than 1,200 characters, so each produces one chunk. The splitter allows larger documents to be supported without changing the ingestion pipeline.

OpenAI's `text-embedding-3-small` model generates embeddings for the chunks, which are stored in a process-local LangChain `InMemoryVectorStore`. For each ticket, the retriever selects the three most similar chunks and removes results below the configured cosine-similarity threshold of `0.35`.

The retrieved content is passed to the LLM with instructions to:

- Use only the supplied company documentation.
- Avoid inventing policies, contacts, procedures, approvals, or links.
- Return the exact filenames used as sources.
- Report that the request is unsupported when the retrieved articles cannot answer it.

The backend verifies that every citation returned by the model belongs to the retrieved source set. Invalid citations fail closed. A no-match or unsupported answer produces a clear no-guidance result, while a service failure leaves manual replying available. In production, I would select the similarity threshold using a representative retrieval evaluation dataset rather than assuming a fixed value is suitable for every corpus.

Classification is a separate LLM call. It returns a category, priority, and model-reported confidence score through a strict structured-output schema.

### How did you handle a category outside the allowed list?

The permitted categories are `IT`, `HR`, `Finance`, `Admin`, and `Other`. OpenAI structured output and a Pydantic `Literal` schema enforce that list, so an unrecognized category fails validation instead of being stored. The database also has a check constraint as a final safeguard.

If classification fails because of invalid output, a timeout, or a provider error, the ticket is still created with:

- Category: `Other`
- Priority: `Medium`
- Classification status: `failed`
- AI confidence: `null`

There is currently no confidence cutoff for accepting a valid category. The score is constrained to the range zero to one and shown to the agent, but it represents the model's reported uncertainty rather than a calibrated probability. A future version could route low-confidence suggestions for manual categorization, with the cutoff selected through evaluation data.

### Where did you store the JWT on the client, and why?

The JWT is stored in an HttpOnly cookie scoped to `/api`. Frontend JavaScript cannot directly read it, which reduces the risk of JWT theft through XSS. The cookie uses `SameSite=Strict`, and `Secure` is enabled in production.

State-changing requests require a separate CSRF token in the `X-CSRF-Token` header. The frontend holds that token in memory rather than persistent browser storage. Supplied `Origin` headers must also match a configured origin.

The JWT is valid for eight hours and contains a session ID. The backend checks that ID against a database session record on every authenticated request, allowing logout to revoke the session immediately. For production, I would consider short-lived access tokens and rotating refresh tokens based on the required balance between security and usability.

### How did you enforce role-based access on the backend?

Authorization is enforced by the backend rather than relying on hidden frontend routes. Every protected request validates the JWT, loads the user, and confirms that the database session still exists. Agent-only endpoints use an authorization dependency that returns `403 Forbidden` unless the authenticated user has the `agent` role.

Employee ticket queries are filtered by the authenticated employee's user ID. If an employee guesses another ticket's URL, the backend returns `404` instead of exposing that ticket. Manually entering an agent URL or calling it through Postman therefore does not bypass authorization. Agent creation is restricted to the local seed or admin process, and passwords are stored as Argon2 hashes.

### Why did you choose SSE, and what happens if the connection drops?

I chose Server-Sent Events because the real-time requirement is one-directional: the server needs to notify browsers about ticket changes. Ticket creation, updates, and replies continue to use ordinary HTTP APIs.

Events are persisted in PostgreSQL. Each SSE stream polls for relevant events every two seconds. Employees receive only their own events, while agents receive all ticket events.

If the connection drops, the browser automatically attempts to reconnect. On every new connection, the backend emits a `ready` event that causes the frontend to refetch authoritative state. It also emits `ready` every 15 seconds to reconcile concurrent commits or missed notifications. Consequently, SSE acts as an invalidation signal; PostgreSQL and the HTTP API remain the system of record. Streams expire with the JWT and regularly check whether the database session has been revoked.

The main scalability limitation is one database query per active stream every two seconds. For production, I would retain SSE but distribute events through Redis Pub/Sub, PostgreSQL `LISTEN/NOTIFY`, or a message broker. I would choose WebSockets if continuous bidirectional communication became necessary.

### What is the worst failure mode today, and how would you address it?

The most significant failure mode is that classification runs synchronously during ticket creation and before the ticket is persisted. If OpenAI is slow or unavailable, the HTTP request waits until the model responds or the 45-second timeout is reached. A handled timeout or provider error still creates the ticket as `Other` with `Medium` priority, no confidence score, and a failed classification state. However, a backend process failure while waiting for OpenAI could prevent the ticket from being saved.

The application supports only OpenAI and has no fallback LLM or embedding provider. An OpenAI outage therefore disables automatic classification and AI-generated replies. If embeddings are unavailable during startup, the knowledge index cannot be built, although the manual helpdesk workflow remains available.

I would first persist the ticket with a `pending` classification status and then enqueue classification as a background job. A worker would process it asynchronously with retries, timeouts, idempotency, and circuit breaking. I would then add a provider abstraction for a tested fallback LLM and embedding provider. Before enabling automatic failover, I would add offline evaluation datasets and production monitoring to confirm consistent categories, priorities, retrieval results, and grounded responses across providers.

### Where did AI tools help most, and where did they hurt or mislead you?

Codex assisted extensively with scaffolding, implementation, refactoring, test creation, and identifying security and edge-case concerns. I remained responsible for the architecture, requirements, configuration, reviewing generated code, and validating the completed workflows.

The tool was less effective when product preferences were not explicitly specified. Its initial UI was functional but generic because it did not have a detailed design reference such as a Figma file. It also initially introduced a Docker-based PostgreSQL setup even though I had selected Neon. Those cases reinforced the need to give AI tools precise constraints and review every architectural and product decision rather than accepting generated code without verification.

## Verification

```powershell
# From backend: isolated SQLite tests, mocked AI, no external writes
.venv/Scripts/python.exe -m unittest discover -s tests -v
# Read-only database connectivity
.venv/Scripts/python.exe -m app.scripts.check_services
# Also makes two small, billable synthetic OpenAI calls
.venv/Scripts/python.exe -m app.scripts.check_services --openai
# Optional live workflow: creates a labeled demo ticket and resolves it
.venv/Scripts/python.exe -m app.scripts.smoke
# Optional live SSE check: creates and resolves a second labeled demo ticket
.venv/Scripts/python.exe -m app.scripts.smoke_events
# From frontend
npm run build
```

The isolated tests cover authentication, CSRF, revocation, role/ownership checks, validation and filters, audit events, immutable drafts, duplicate resolution, AI failure fallback, event scoping, knowledge-article loading, and citation rejection. A live Neon/OpenAI workflow was verified with a VPN ticket classified IT/Medium and a draft citing two articles. Live SSE checks confirmed both employee and agent sessions received creation and resolution events. An unrelated recipe query returned the no-guidance fallback. SQLite tests do not prove PostgreSQL lock behavior under simultaneous load.

## Known limitations and more time

- No login or AI-call rate limiting, production monitoring, or background job queue. Deploy behind appropriate controls before broader use.
- Add a provider abstraction so the application can support tested alternative LLM and embedding providers, including controlled fallback when OpenAI is unavailable.
- Add offline evaluations with representative labeled tickets and retrieval cases, plus online evaluations and production monitoring for classification accuracy, retrieval relevance, groundedness, latency, failures, and agent overrides.
- Six fictional articles are demonstration content, not real company policy. Attachments store filenames only.
- No ticket reopening, follow-up thread, public registration, email delivery, or actual upload handling.
- SSE polling and Python-side median calculation suit a small assessment dataset. At scale, use a shared event broker, periodic event/session cleanup, and database-side percentile aggregation.
- RAG is explicitly retrieved and grounded, but cannot guarantee hallucination-free output. Add a larger retrieval evaluation set and policy-specific review checks before real use.
- The in-memory knowledge index is rebuilt for every backend process and restart. This is simple for the small assessment dataset but adds startup time and embedding calls; a persistent vector store is more suitable at production scale.
- Production hosting, a public GitHub repository, and the demo recording remain separate submission steps. No deployment was performed.
