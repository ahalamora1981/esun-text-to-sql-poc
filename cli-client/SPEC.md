# Text-to-SQL CLI Client — Technical Specification

## 1. Project Overview

Interactive CLI REPL client for the Text-to-SQL system. Communicates with the backend API over HTTP, providing a rich terminal interface with multi-turn conversation support, colored output, debug mode, and built-in commands.

## 2. Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.12+ |
| Package Manager | uv |
| HTTP Client | httpx |
| Terminal UI | rich |
| Configuration | pydantic-settings, python-dotenv |
| Testing | pytest |

## 3. Directory Structure

```
cli-client/
├── SPEC.md
├── pyproject.toml
├── .env.example
├── src/
│   └── text_to_sql_cli/
│       ├── __init__.py
│       ├── __main__.py      # Console scripts entry point
│       ├── main.py           # REPL loop, debug display, command routing
│       └── client.py         # BackendClient: HTTP wrapper (httpx)
└── tests/
    ├── __init__.py
    └── test_cli.py           # Client settings + BackendClient mock tests (6 cases)
```

## 4. Entry Point

Console script: `text-to-sql-cli` → `text_to_sql_cli.__main__:main`

```bash
uv run text-to-sql-cli           # Normal mode
uv run text-to-sql-cli --debug   # Debug mode (shows SQL queries, tool calls, etc.)
```

## 5. Backend Communication

The CLI communicates with the backend via HTTP using `httpx`:

| Action | HTTP Method | Endpoint | Used when |
|--------|-------------|----------|-----------|
| Health check | GET | `/health` | Startup |
| Create session | POST | `/api/sessions` | Startup, `/clear` |
| Delete session | DELETE | `/api/sessions/{id}` | `/clear` |
| Send query (sync) | POST | `/api/query` | Normal mode |
| Send query (stream) | POST | `/api/query/stream` | Debug mode (`--debug`) |
| List tables | GET | `/api/tables` | `/tables` command |
| Get schema | GET | `/api/schema` | `/schema` command |

The base URL is configured via `BACKEND_URL` environment variable (default: `http://127.0.0.1:8000`).

### Normal Mode

Calls `POST /api/query`, waits for full response, displays in a rich panel.

### Debug Mode (`--debug`)

Calls `POST /api/query/stream`, receives SSE events in real-time, and renders:
- `[THINK] 调用工具: execute_sql_tool` — when agent calls a tool
- Yellow panel with SQL query — when `execute_sql_tool` is invoked with a SQL `query` arg
- Blue panel with tool results — when tool execution returns data
- `[dim] thinking text[/dim]` — when agent produces intermediate thinking
- Final response in a cyan panel — when agent produces the final answer

## 6. CLI Commands

| Command | Description |
|---------|-------------|
| `/help` | Display available commands and usage instructions |
| `/quit` | Exit the CLI |
| `/exit` | Exit the CLI (alias for `/quit`) |
| `/clear` | Clear conversation history — deletes current session and creates a new one |
| `/tables` | Display available business tables with descriptions (fetched from backend) |
| `/schema` | Display full database DDL (fetched from backend) |

All other input is treated as a natural language query.

## 7. Session Management

- On startup, the CLI creates a new session via `POST /api/sessions` and stores the `session_id`.
- Every query includes this `session_id` to maintain multi-turn context (persisted on server).
- `/clear` deletes the current session and creates a new one, effectively resetting conversation history.
- On exit (`/quit`), the CLI simply closes the connection.

## 8. Configuration

Environment variables loaded via `.env` (pydantic-settings):

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://127.0.0.1:8000` | Backend API base URL |

## 9. Development Commands

| Command | Description |
|---------|-------------|
| `uv sync --extra dev` | Install all dependencies including test tools |
| `uv run pytest tests/ -v` | Run all tests (6 cases) |
| `uv run text-to-sql-cli` | Start the CLI client |
| `uv run text-to-sql-cli --debug` | Start the CLI in debug mode |

## 10. Dependencies

```
# Core
httpx
rich
pydantic-settings

# Dev
pytest
httpx
```
