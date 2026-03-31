import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .config import load_settings


def _get_meta_db_path() -> str:
    settings = load_settings()
    path = settings.meta_db_path
    if not os.path.isabs(path):
        project_root = Path(__file__).parent.parent.parent
        path = str(project_root / path)
    return path


_meta_initialized = False


def _get_conn() -> sqlite3.Connection:
    global _meta_initialized
    db_path = _get_meta_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    if not _meta_initialized:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS session_meta (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '新对话',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES session_meta(session_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_session_meta_user ON session_meta(user_id);
            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        """)
        _meta_initialized = True
    return conn


@contextmanager
def _get_db():
    conn = _get_conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_meta_db():
    _get_conn().close()


def create_token(user_id: str, username: str) -> str:
    token = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO tokens (token, user_id, username, created_at) VALUES (?, ?, ?, ?)",
            (token, user_id, username, now),
        )
    return token


def get_token_info(token: str) -> dict | None:
    with _get_db() as conn:
        row = conn.execute("SELECT * FROM tokens WHERE token = ?", (token,)).fetchone()
        if row is None:
            return None
        return dict(row)


def delete_token(token: str):
    with _get_db() as conn:
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))


def create_session(session_id: str, user_id: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO session_meta (session_id, user_id, title, created_at, updated_at) VALUES (?, ?, '新对话', ?, ?)",
            (session_id, user_id, now, now),
        )
    return {
        "session_id": session_id,
        "title": "新对话",
        "created_at": now,
        "updated_at": now,
    }


def list_sessions(user_id: str) -> list[dict]:
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT session_id, title, created_at, updated_at FROM session_meta WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_session(session_id: str, user_id: str) -> dict | None:
    with _get_db() as conn:
        row = conn.execute(
            "SELECT session_id, title, created_at, updated_at FROM session_meta WHERE session_id = ? AND user_id = ?",
            (session_id, user_id),
        ).fetchone()
    return dict(row) if row else None


def update_session_title(session_id: str, user_id: str, title: str):
    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        conn.execute(
            "UPDATE session_meta SET title = ?, updated_at = ? WHERE session_id = ? AND user_id = ?",
            (title, now, session_id, user_id),
        )


def delete_session_meta(session_id: str, user_id: str) -> bool:
    with _get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM session_meta WHERE session_id = ? AND user_id = ?",
            (session_id, user_id),
        )
        return cursor.rowcount > 0


def save_message(
    session_id: str, role: str, content: str, metadata: dict | None = None
) -> str:
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    meta_json = json.dumps(metadata, ensure_ascii=False) if metadata else None
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (msg_id, session_id, role, content, meta_json, now),
        )
    return msg_id


def get_messages(session_id: str) -> list[dict]:
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT id, session_id, role, content, metadata, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("metadata"):
            d["metadata"] = json.loads(d["metadata"])
        result.append(d)
    return result
