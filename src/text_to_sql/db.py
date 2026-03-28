import sqlite3
import os
from pathlib import Path

from .config import Settings

_settings = Settings()

TABLE_DESCRIPTIONS = {
    "funds": "基金基本信息（名称、类型、规模、状态）",
    "companies": "被投企业信息（名称、行业、地区、投资阶段）",
    "fund_investments": "基金投资记录（基金→企业、金额、持股比例、轮次）",
    "shareholders": "LP/股东信息（名称、类型、认缴总额）",
    "fund_shareholders": "基金-LP 关系（认缴金额、实缴金额、占比）",
    "quarterly_reports": "季度报告（AUM、净值、收益率、累计投资额）",
    "financial_statements": "企业财务数据（营业收入、净利润、总资产、总负债）",
}


def get_db_path() -> str:
    path = _settings.db_path
    if not os.path.isabs(path):
        project_root = Path(__file__).parent.parent.parent
        path = str(project_root / path)
    return path


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def get_all_ddl() -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"
    )
    ddl_list = [row["sql"] for row in cursor.fetchall()]
    conn.close()
    return "\n\n".join(ddl_list)


def get_sample_rows(table_name: str, n: int = 3) -> list[dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM {table_name} LIMIT {n}")
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return rows
    except sqlite3.OperationalError:
        return []


def get_all_sample_rows() -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()

    parts = []
    for table in tables:
        rows = get_sample_rows(table)
        if rows:
            parts.append(f"-- {table} (示例数据) --")
            cols = list(rows[0].keys())
            parts.append(" | ".join(cols))
            parts.append("-" * 40)
            for row in rows:
                parts.append(" | ".join(str(v) for v in row.values()))
            parts.append("")
    return "\n".join(parts)


def execute_sql(query: str) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(query)
        if cursor.description is None:
            conn.commit()
            return "操作执行成功。"
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        if not rows:
            return "查询结果为空。"
        lines = [" | ".join(columns)]
        lines.append("-" * 60)
        for row in rows:
            lines.append(" | ".join(str(v) if v is not None else "NULL" for v in row))
        return "\n".join(lines)
    finally:
        conn.close()


def list_tables_info() -> str:
    ddl = get_all_ddl()
    if not ddl:
        return "数据库中没有表。"
    return ddl
