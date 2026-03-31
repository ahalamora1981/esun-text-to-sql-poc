import uvicorn

from .config import load_settings
from .api import app


def main():
    settings = load_settings()
    print(
        f"Starting Text-to-SQL Backend API on {settings.server_host}:{settings.server_port}"
    )
    uvicorn.run(
        "text_to_sql_backend.api:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=False,
    )


if __name__ == "__main__":
    main()
