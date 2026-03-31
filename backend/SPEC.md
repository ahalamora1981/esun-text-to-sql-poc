# Text-to-SQL Backend API — Technical Specification

## 1. Project Overview

Backend REST API service for the Text-to-SQL system. Receives natural language queries over HTTP, uses a LangChain agent (with middleware pipeline) to convert them to SQL, executes against SQLite, and returns natural language answers. Supports multi-turn conversation via client-managed sessions with SQLite-based state persistence.

## 2. Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.12+ |
| Package Manager | uv |
| AI Framework | LangChain v1 (`create_agent` + middleware) |
| LLM | Qwen3.5-27B (vLLM, OpenAI-compatible API) |
| API Framework | FastAPI |
| ASGI Server | uvicorn |
| Session Persistence | langgraph-checkpoint-sqlite (`SqliteSaver`) |
| Business Database | SQLite (`vc_test.db`) |
| Configuration | pydantic-settings, python-dotenv |
| Testing | pytest |

## 3. Directory Structure

```
backend/
├── SPEC.md
├── pyproject.toml
├── .env.example
├── data/
│   ├── init_db.py              # 7-table DDL + seed data, generates vc_test.db
│   ├── vc_test.db              # Business data (gitignored)
│   └── sessions.db             # Session checkpoints (gitignored, auto-created)
├── src/
│   └── text_to_sql_backend/
│       ├── __init__.py
│       ├── server.py           # uvicorn launcher (console_scripts entry point)
│       ├── api.py              # FastAPI app, route definitions, SSE streaming
│       ├── agent.py            # create_agent assembly + tools (execute_sql_tool, list_tables)
│       ├── config.py           # Settings: LLM endpoint, DB path, server host/port, session DB
│       ├── db.py               # SQLite connection, DDL extraction, SQL execution, TABLE_DESCRIPTIONS
│       ├── prompts.py          # Base system prompt template
│       ├── checkpoint.py       # SqliteSaver singleton for session persistence
│       └── middleware/
│           ├── __init__.py
│           ├── schema_prompt.py    # @dynamic_prompt: inject DDL + sample rows
│           ├── question_guard.py   # before_model: LLM relevance check + clarification
│           └── sql_retry.py        # wrap_tool_call: SQL error feedback + retry counter
└── tests/
    ├── __init__.py
    ├── test_tools.py            # DB layer tests (9 cases)
    └── test_middleware.py       # QuestionGuard (18) + SqlRetry (5) tests
```

## 4. API Endpoints

### 4.1 POST /api/query

Execute a natural language query within a session (non-streaming).

**Request:**

```json
{
  "message": "星辰成长基金的规模是多少",
  "session_id": "uuid-string"
}
```

**Response (200):**

```json
{
  "response": "星辰成长基金的规模为10.0亿元。",
  "session_id": "uuid-string"
}
```

**Errors:**
- `500` — LLM unavailable, no response generated, or other runtime error

---

### 4.2 POST /api/query/stream

Execute a natural language query with SSE streaming. Returns intermediate agent messages (SQL tool calls, tool results, thinking) in real-time, followed by the final response. Used by CLI debug mode and future web-app.

**Request:** Same as `POST /api/query`.

**Response:** `text/event-stream` — each SSE event is `data: <JSON>\n\n` with one of the following types:

| Event type | Description |
|------------|-------------|
| `human` | User message echo |
| `ai_tool_call` | Agent calling a tool (`tool_name`, `args`) |
| `ai_thinking` | Agent thinking text (no tool call) |
| `tool_result` | Tool execution result (`content`, `tool_name`) |
| `ai_response` | Final natural language answer |
| `error` | Runtime error message |
| `done` | Stream complete |

---

### 4.3 POST /api/sessions

Create a new conversation session.

**Request:** (empty body)

**Response (200):**

```json
{
  "session_id": "uuid-string"
}
```

---

### 4.4 DELETE /api/sessions/{session_id}

Delete a session.

**Response (200):**

```json
{
  "status": "ok"
}
```

---

### 4.5 GET /api/tables

Return available business tables with descriptions.

**Response (200):**

```json
[
  { "name": "funds", "description": "基金基本信息（名称、类型、规模、状态）" },
  ...
]
```

---

### 4.6 GET /api/schema

Return the full DDL for all business tables.

**Response (200):**

```json
{
  "ddl": "CREATE TABLE funds (...)\n\nCREATE TABLE companies (...)"
}
```

---

### 4.7 GET /health

Health check endpoint.

**Response (200):**

```json
{
  "status": "ok"
}
```

## 5. Session Management

- Sessions are **client-managed**: the client creates a session via `POST /api/sessions`, receives a `session_id` (UUID), and includes it in every query request.
- Session state (conversation history / checkpoints) is persisted in `data/sessions.db` using LangChain's `SqliteSaver`.
- The `SqliteSaver` instance is initialized as a singleton via `checkpoint.py`.

## 6. Architecture

```
┌──────────────┐       HTTP        ┌─────────────────────────────────┐
│  cli-client  │  ───────────────► │         FastAPI App             │
│   / web-app  │                    │                                 │
└──────────────┘                    │  POST /api/query  ──────────┐   │
                                    │  POST /api/query/stream ────┤   │
                                    │  POST /api/sessions         │   │
                                    │  GET  /api/tables           │   │
                                    │  GET  /api/schema           │   │
                                    │  GET  /health               │   │
                                    │                              │   │
                                    │  ┌───────────────────────┐   │   │
                                    │  │  LangChain Agent       │   │   │
                                    │  │  + Middleware:         │   │   │
                                    │  │    @dynamic_prompt    │   │   │
                                    │  │    QuestionGuard      │   │   │
                                    │  │    SqlRetry           │   │   │
                                    │  │  + Tools:             │   │   │
                                    │  │    execute_sql_tool   │───┼───┼──► SQLite (vc_test.db)
                                    │  │    list_tables         │   │   │
                                    │  └───────────────────────┘   │   │
                                    │                              │   │
                                    │  SqliteSaver ◄────────────────┼───┼── SQLite (sessions.db)
                                    └─────────────────────────────────┘
```

## 7. Configuration

Environment variables loaded via `.env` (pydantic-settings):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | `None` | LLM API key |
| `OPENAI_BASE_URL` | `http://10.101.100.11:8017/v1` | LLM endpoint (OpenAI-compatible) |
| `OPENAI_MODEL` | `/models/Qwen3.5-27B-UD-Q8_K_XL.gguf` | LLM model name |
| `DB_PATH` | `data/vc_test.db` | Business database path (relative to backend/) |
| `SESSION_DB_PATH` | `data/sessions.db` | Session checkpoint DB path |
| `SERVER_HOST` | `127.0.0.1` | API server bind address |
| `SERVER_PORT` | `8000` | API server port |

## 8. Development Commands

| Command | Description |
|---------|-------------|
| `uv sync --extra dev` | Install all dependencies including test tools |
| `uv run pytest tests/ -v` | Run all tests (32 cases) |
| `uv run python data/init_db.py` | Initialize / reset the test database |
| `uv run text-to-sql-server` | Start the API server (default: `127.0.0.1:8000`) |

## 9. Dependencies

```
# Core
langchain>=1.1
langchain-openai
python-dotenv
pydantic
pydantic-settings
fastapi
uvicorn[standard]
langgraph-checkpoint-sqlite>=3.0.3

# Dev
pytest
httpx
```
