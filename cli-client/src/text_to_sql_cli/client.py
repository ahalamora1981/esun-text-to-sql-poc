import json

import httpx

from pydantic_settings import BaseSettings


class ClientSettings(BaseSettings):
    backend_url: str = "http://127.0.0.1:8000"

    model_config = {"env_file": ".env", "env_prefix": ""}


class BackendClient:
    def __init__(self, settings: ClientSettings | None = None):
        self._settings = settings or ClientSettings()
        self._http = httpx.Client(base_url=self._settings.backend_url, timeout=120.0)

    def health(self) -> dict:
        resp = self._http.get("/health")
        resp.raise_for_status()
        return resp.json()

    def create_session(self) -> str:
        resp = self._http.post("/api/sessions")
        resp.raise_for_status()
        return resp.json()["session_id"]

    def delete_session(self, session_id: str) -> dict:
        resp = self._http.delete(f"/api/sessions/{session_id}")
        resp.raise_for_status()
        return resp.json()

    def query(self, message: str, session_id: str) -> dict:
        resp = self._http.post(
            "/api/query", json={"message": message, "session_id": session_id}
        )
        resp.raise_for_status()
        return resp.json()

    def query_stream(self, message: str, session_id: str):
        with self._http.stream(
            "POST",
            "/api/query/stream",
            json={"message": message, "session_id": session_id},
            timeout=120.0,
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    yield json.loads(data)

    def list_tables(self) -> list[dict]:
        resp = self._http.get("/api/tables")
        resp.raise_for_status()
        return resp.json()

    def get_schema(self) -> str:
        resp = self._http.get("/api/schema")
        resp.raise_for_status()
        return resp.json()["ddl"]

    def close(self):
        self._http.close()
