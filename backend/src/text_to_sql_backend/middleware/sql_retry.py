import sqlite3
from typing import Callable

from langchain.agents.middleware import AgentMiddleware
from langchain.tools.tool_node import ToolCallRequest
from langchain.messages import ToolMessage
from langgraph.types import Command


class SqlRetryMiddleware(AgentMiddleware):
    def __init__(self, max_retries: int = 3):
        super().__init__()
        self.max_retries = max_retries
        self._retry_counts: dict[str, int] = {}

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        if request.tool_call["name"] != "execute_sql":
            return handler(request)

        call_id: str = str(request.tool_call.get("id", ""))
        count = self._retry_counts.get(call_id, 0)

        if count >= self.max_retries:
            self._retry_counts.pop(call_id, None)
            return ToolMessage(
                content="SQL 查询多次尝试后仍然失败。请尝试换一种问法，"
                "或者使用 /tables 命令查看可用的表结构。",
                tool_call_id=call_id,
            )

        try:
            result = handler(request)
            self._retry_counts.pop(call_id, None)
            return result
        except sqlite3.OperationalError as e:
            self._retry_counts[call_id] = count + 1
            remaining = self.max_retries - count
            return ToolMessage(
                content=f"SQL 执行出错：{e}\n\n"
                f"请根据错误信息修正 SQL 并重试（剩余 {remaining} 次机会）。",
                tool_call_id=call_id,
            )
        except sqlite3.Error as e:
            self._retry_counts.pop(call_id, None)
            return ToolMessage(
                content=f"数据库错误：{e}",
                tool_call_id=call_id,
            )
