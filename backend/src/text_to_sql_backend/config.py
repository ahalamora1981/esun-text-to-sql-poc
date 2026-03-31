from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = "None"
    openai_base_url: str = "http://10.101.100.11:8017/v1"
    openai_model: str = "/models/Qwen3.5-27B-UD-Q8_K_XL.gguf"
    db_path: str = "data/vc_test.db"
    session_db_path: str = "data/sessions.db"
    server_host: str = "127.0.0.1"
    server_port: int = 8000

    model_config = {"env_file": ".env", "env_prefix": ""}


def load_settings() -> Settings:
    return Settings()
