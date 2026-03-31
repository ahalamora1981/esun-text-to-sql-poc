import os
from contextlib import contextmanager
from pathlib import Path

from langgraph.checkpoint.sqlite import SqliteSaver

_checkpointer = None
_cm = None


def get_session_db_path() -> str:
    from .config import Settings

    settings = Settings()
    path = settings.session_db_path
    if not os.path.isabs(path):
        project_root = Path(__file__).parent.parent.parent
        path = str(project_root / path)
    return path


def get_checkpointer():
    global _checkpointer, _cm
    if _checkpointer is None:
        db_path = get_session_db_path()
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        _cm = SqliteSaver.from_conn_string(db_path)
        _checkpointer = _cm.__enter__()
    return _checkpointer
