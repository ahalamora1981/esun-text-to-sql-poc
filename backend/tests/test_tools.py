import gc
import os
import tempfile
import pytest

from text_to_sql_backend.config import Settings
from text_to_sql_backend.db import (
    get_connection,
    get_all_ddl,
    get_sample_rows,
    get_all_sample_rows,
    execute_sql,
)

TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "test_vc.db")


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    from data.init_db import init_db

    init_db(TEST_DB_PATH)
    monkeypatch.setattr(
        "text_to_sql_backend.db._settings", Settings(db_path=TEST_DB_PATH)
    )
    yield
    gc.collect()
    try:
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    except PermissionError:
        pass


class TestDbBasics:
    def test_get_connection(self):
        conn = get_connection()
        assert conn is not None
        conn.close()

    def test_get_all_ddl(self):
        ddl = get_all_ddl()
        assert "funds" in ddl
        assert "companies" in ddl
        assert "financial_statements" in ddl

    def test_get_sample_rows(self):
        rows = get_sample_rows("funds")
        assert len(rows) == 3
        assert rows[0]["name"] == "星辰成长基金"

    def test_get_sample_rows_invalid_table(self):
        rows = get_sample_rows("nonexistent")
        assert rows == []

    def test_get_all_sample_rows(self):
        samples = get_all_sample_rows()
        assert "funds" in samples
        assert "companies" in samples


class TestExecuteSql:
    def test_select_query(self):
        result = execute_sql("SELECT name, fund_type FROM funds")
        assert "星辰成长基金" in result

    def test_select_empty_result(self):
        result = execute_sql("SELECT * FROM funds WHERE name = '不存在'")
        assert "查询结果为空" in result

    def test_non_select_blocked(self):
        from text_to_sql_backend.agent import execute_sql_tool

        result = execute_sql_tool.invoke({"query": "DELETE FROM funds WHERE 1=1"})
        assert "错误" in result or "不允许" in result

    def test_select_with_aggregation(self):
        result = execute_sql("SELECT COUNT(*) FROM companies")
        assert "5" in result
