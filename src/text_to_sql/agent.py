import re
from pydantic import SecretStr
from langchain.tools import tool
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

from .config import load_settings
from .db import execute_sql, TABLE_DESCRIPTIONS, list_tables_info
from .middleware.schema_prompt import inject_schema
from .middleware.question_guard import QuestionGuardMiddleware
from .middleware.sql_retry import SqlRetryMiddleware
from .prompts import BASE_SYSTEM_PROMPT

SELECT_PATTERN = re.compile(r"^\s*SELECT\s", re.IGNORECASE)


@tool
def execute_sql_tool(query: str) -> str:
    """执行 SQL 查询并返回结果。仅支持 SELECT 查询，不支持 INSERT/UPDATE/DELETE/DROP。"""
    if not SELECT_PATTERN.match(query):
        return "错误：仅支持 SELECT 查询，不允许执行 INSERT/UPDATE/DELETE/DROP 等修改操作。"
    return execute_sql(query)


@tool
def list_tables() -> str:
    """列出数据库中所有可用的表及其简要说明。"""
    lines = []
    for name, desc in TABLE_DESCRIPTIONS.items():
        lines.append(f"  {name}: {desc}")
    return "\n".join(lines)


def build_agent():
    settings = load_settings()

    model = ChatOpenAI(
        base_url=settings.openai_base_url,
        api_key=SecretStr(settings.openai_api_key),
        model=settings.openai_model,
        temperature=0.0,
    )

    agent = create_agent(
        model=model,
        tools=[execute_sql_tool, list_tables],
        system_prompt=BASE_SYSTEM_PROMPT,
        middleware=[
            inject_schema,
            QuestionGuardMiddleware(),
            SqlRetryMiddleware(max_retries=3),
        ],
        checkpointer=InMemorySaver(),
    )

    return agent
