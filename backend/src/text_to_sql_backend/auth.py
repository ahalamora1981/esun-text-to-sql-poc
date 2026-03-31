import os
from pathlib import Path

import yaml
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import load_settings
from .session_meta import create_token, delete_token, get_token_info, init_meta_db

security = HTTPBearer(auto_error=False)

_users_cache: list[dict] | None = None


def _load_users() -> list[dict]:
    global _users_cache
    if _users_cache is not None:
        return _users_cache

    settings = load_settings()
    users_file = settings.users_file
    if not os.path.isabs(users_file):
        project_root = Path(__file__).parent.parent.parent
        users_file = str(project_root / users_file)

    if not os.path.exists(users_file):
        raise FileNotFoundError(f"Users file not found: {users_file}")

    with open(users_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    _users_cache = data.get("users", []) if data else []
    return _users_cache


def authenticate_user(username: str, password: str) -> dict:
    users = _load_users()
    for u in users:
        if u["username"] == username and u["password"] == password:
            return u
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )


def login_user(username: str, password: str) -> dict:
    user = authenticate_user(username, password)
    user_id = user["username"]
    token = create_token(user_id, username)
    return {"token": token, "username": username}


def logout_user(token: str) -> dict:
    delete_token(token)
    return {"status": "ok"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = credentials.credentials
    info = get_token_info(token)
    if info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return {"user_id": info["user_id"], "username": info["username"]}
