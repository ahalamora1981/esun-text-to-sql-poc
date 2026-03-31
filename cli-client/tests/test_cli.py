import pytest
from unittest.mock import MagicMock, patch
from text_to_sql_cli.client import BackendClient, ClientSettings


class TestClientSettings:
    def test_default_url(self):
        settings = ClientSettings()
        assert settings.backend_url == "http://127.0.0.1:8000"


class TestBackendClient:
    def setup_method(self):
        self.client = BackendClient(
            settings=ClientSettings(backend_url="http://localhost:9999")
        )

    def teardown_method(self):
        self.client.close()

    @patch("text_to_sql_cli.client.httpx.Client")
    def test_health(self, mock_http_cls):
        mock_instance = MagicMock()
        mock_instance.get.return_value = MagicMock(
            json=lambda: {"status": "ok"}, raise_for_status=lambda: None
        )
        mock_http_cls.return_value = mock_instance

        client = BackendClient(
            settings=ClientSettings(backend_url="http://localhost:9999")
        )
        result = client.health()
        assert result == {"status": "ok"}
        mock_instance.get.assert_called_once_with("/health")

    @patch("text_to_sql_cli.client.httpx.Client")
    def test_create_session(self, mock_http_cls):
        mock_instance = MagicMock()
        mock_instance.post.return_value = MagicMock(
            json=lambda: {"session_id": "test-uuid-123"},
            raise_for_status=lambda: None,
        )
        mock_http_cls.return_value = mock_instance

        client = BackendClient(
            settings=ClientSettings(backend_url="http://localhost:9999")
        )
        sid = client.create_session()
        assert sid == "test-uuid-123"
        mock_instance.post.assert_called_once_with("/api/sessions")

    @patch("text_to_sql_cli.client.httpx.Client")
    def test_query(self, mock_http_cls):
        mock_instance = MagicMock()
        mock_instance.post.return_value = MagicMock(
            json=lambda: {
                "response": "星辰成长基金规模为10亿元。",
                "session_id": "test-uuid",
            },
            raise_for_status=lambda: None,
        )
        mock_http_cls.return_value = mock_instance

        client = BackendClient(
            settings=ClientSettings(backend_url="http://localhost:9999")
        )
        result = client.query("星辰基金的规模", "test-uuid")
        assert result["response"] == "星辰成长基金规模为10亿元。"

    @patch("text_to_sql_cli.client.httpx.Client")
    def test_list_tables(self, mock_http_cls):
        mock_instance = MagicMock()
        mock_instance.get.return_value = MagicMock(
            json=lambda: [{"name": "funds", "description": "基金信息"}],
            raise_for_status=lambda: None,
        )
        mock_http_cls.return_value = mock_instance

        client = BackendClient(
            settings=ClientSettings(backend_url="http://localhost:9999")
        )
        tables = client.list_tables()
        assert len(tables) == 1
        assert tables[0]["name"] == "funds"

    @patch("text_to_sql_cli.client.httpx.Client")
    def test_get_schema(self, mock_http_cls):
        mock_instance = MagicMock()
        mock_instance.get.return_value = MagicMock(
            json=lambda: {"ddl": "CREATE TABLE funds (...)"},
            raise_for_status=lambda: None,
        )
        mock_http_cls.return_value = mock_instance

        client = BackendClient(
            settings=ClientSettings(backend_url="http://localhost:9999")
        )
        schema = client.get_schema()
        assert "CREATE TABLE" in schema
