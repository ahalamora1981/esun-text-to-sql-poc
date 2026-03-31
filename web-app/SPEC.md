# Text-to-SQL Web App — Technical Specification (Placeholder)

## 1. Project Overview

Planned web application for the Text-to-SQL system. Will provide a browser-based interface for natural language queries against the VC business database, as an alternative to the CLI client.

## 2. Planned Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | React / Vue (TBD) |
| API Communication | HTTP (same backend API as cli-client) |
| Real-time Updates | SSE (`POST /api/query/stream`) |
| Build Tool | TBD |

## 3. Architecture

Will communicate with the same backend REST API as the CLI client. No separate backend required — the existing FastAPI backend serves both interfaces.

Key API endpoints:
- `POST /api/query` — non-streaming query
- `POST /api/query/stream` — SSE streaming (for real-time SQL query / tool result display)
- `POST /api/sessions` / `DELETE /api/sessions/{id}` — session management
- `GET /api/tables` / `GET /api/schema` — metadata

## 4. Status

**Planning phase — not yet implemented.** See project root `PRD.md` for shared product requirements. See `backend/SPEC.md` for the full API specification.
