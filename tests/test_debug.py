import sys
import io
import os
import tempfile
import gc
from unittest.mock import MagicMock, patch, call

import pytest
from rich.console import Console

from langchain.messages import HumanMessage, AIMessage, ToolMessage

from text_to_sql.main import _extract_content, _get_final_response
from text_to_sql.config import Settings

TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "test_vc_debug.db")


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    from data.init_db import init_db

    init_db(TEST_DB_PATH)
    monkeypatch.setattr("text_to_sql.db._settings", Settings(db_path=TEST_DB_PATH))
    yield
    gc.collect()
    try:
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    except PermissionError:
        pass


# ── _extract_content ──────────────────────────────────────────────


class TestExtractContent:
    def test_string_content(self):
        msg = HumanMessage(content="星辰基金的规模是多少")
        assert _extract_content(msg) == "星辰基金的规模是多少"

    def test_empty_string_content(self):
        msg = HumanMessage(content="")
        assert _extract_content(msg) == ""

    def test_list_content_text_dict(self):
        msg = HumanMessage(content=[{"type": "text", "text": "hello"}])
        assert _extract_content(msg) == "hello"

    def test_list_content_mixed_dict_and_str(self):
        msg = HumanMessage(content=[{"type": "text", "text": "hello"}, "world"])
        assert _extract_content(msg) == "helloworld"

    def test_list_content_non_text_dict(self):
        msg = HumanMessage(content=[{"key": "val"}, {"type": "text", "text": "text"}])
        assert _extract_content(msg) == "{'key': 'val'}text"


# ── _get_final_response ──────────────────────────────────────────


class TestGetFinalResponse:
    def test_returns_last_ai_without_tool_calls(self):
        result = {
            "messages": [
                HumanMessage("q"),
                AIMessage(content="answer"),
            ]
        }
        msg = _get_final_response(result)
        assert msg is not None
        assert msg.content == "answer"

    def test_skips_ai_messages_with_tool_calls(self):
        result = {
            "messages": [
                HumanMessage("q"),
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "execute_sql",
                            "id": "c1",
                            "args": {"query": "SELECT 1"},
                        }
                    ],
                ),
                ToolMessage(content="result", tool_call_id="c1"),
                AIMessage(content="final answer"),
            ]
        }
        msg = _get_final_response(result)
        assert msg is not None
        assert msg.content == "final answer"

    def test_returns_none_when_no_ai_message(self):
        result = {"messages": [HumanMessage("q")]}
        assert _get_final_response(result) is None

    def test_returns_none_for_empty_messages(self):
        result = {"messages": []}
        assert _get_final_response(result) is None


# ── _print_debug ─────────────────────────────────────────────────


class TestPrintDebug:
    def _capture(self, messages):
        from text_to_sql.main import _print_debug

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)
        _print_debug(test_console, messages)
        return buf.getvalue()

    def test_human_message_printed(self):
        output = self._capture([HumanMessage("星辰基金的AUM是多少")])
        assert "USER" in output
        assert "星辰基金的AUM" in output

    def test_ai_with_sql_tool_call_shows_query(self):
        msg = AIMessage(content="")
        msg.tool_calls = [
            {
                "name": "execute_sql",
                "id": "c1",
                "args": {"query": "SELECT size FROM funds WHERE name='星辰成长基金'"},
            }
        ]
        output = self._capture([msg])
        assert "execute_sql" in output
        assert "SQL 查询" in output
        assert "SELECT size FROM funds" in output

    def test_ai_with_execute_sql_tool_name_shows_query(self):
        """The actual @tool name is 'execute_sql_tool', not 'execute_sql'."""
        msg = AIMessage(content="")
        msg.tool_calls = [
            {
                "name": "execute_sql_tool",
                "id": "c1",
                "args": {"query": "SELECT size FROM funds WHERE name='星辰成长基金'"},
            }
        ]
        output = self._capture([msg])
        assert "execute_sql_tool" in output
        assert "SQL 查询" in output
        assert "SELECT size FROM funds" in output

    def test_ai_with_list_tables_tool_call(self):
        msg = AIMessage(content="")
        msg.tool_calls = [{"name": "list_tables", "id": "c2", "args": {}}]
        output = self._capture([msg])
        assert "list_tables" in output

    def test_ai_plain_text_shows_thinking(self):
        output = self._capture([AIMessage(content="让我查询一下")])
        assert "THINK" in output
        assert "让我查询一下" in output

    def test_ai_empty_content_no_output(self):
        msg = AIMessage(content="")
        msg.tool_calls = []
        output = self._capture([msg])
        assert output.strip() == ""

    def test_tool_message_shows_result(self):
        msg = ToolMessage(content="size\n10.0", tool_call_id="c1")
        output = self._capture([msg])
        assert "工具返回" in output
        assert "10.0" in output

    def test_tool_message_with_name(self):
        msg = ToolMessage(content="ok", tool_call_id="c1")
        msg.name = "execute_sql"
        output = self._capture([msg])
        assert "execute_sql" in output

    def test_multiple_messages(self):
        msgs = [
            AIMessage(content="让我查一下", tool_calls=[]),
            AIMessage(
                content="",
                tool_calls=[
                    {"name": "execute_sql", "id": "c1", "args": {"query": "SELECT 1"}}
                ],
            ),
            ToolMessage(content="1", tool_call_id="c1"),
            AIMessage(content="结果是1", tool_calls=[]),
        ]
        output = self._capture(msgs)
        assert "让我查一下" in output
        assert "SELECT 1" in output
        assert "结果是1" in output


# ── Debug stream integration ─────────────────────────────────────


class TestDebugStreamIntegration:
    @patch("text_to_sql.main.build_agent")
    def test_debug_shows_sql_and_result(self, mock_build_agent):
        """Verify that in debug mode, SQL and results are streamed in real-time."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()

        ai_call = AIMessage(content="")
        ai_call.tool_calls = [
            {
                "name": "execute_sql_tool",
                "id": "c1",
                "args": {"query": "SELECT size FROM funds WHERE name LIKE '%星辰%'"},
            }
        ]
        tool_result = ToolMessage(content="size\n10.0", tool_call_id="c1")
        ai_final = AIMessage(content="星辰成长基金的规模是10.0亿元。")

        mock_agent.stream.return_value = [
            {"agent": {"messages": [ai_call]}},
            {"tools": {"messages": [tool_result]}},
            {"agent": {"messages": [ai_final]}},
        ]

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(
            mock_agent, "星辰基金的规模", "thread-1", test_console, debug=True
        )

        output = buf.getvalue()
        assert "SELECT size FROM funds" in output, f"SQL not found in output:\n{output}"
        assert "10.0" in output, f"Result not found in output:\n{output}"
        assert "星辰成长基金的规模是10.0亿元" in output, (
            f"Final answer not found in output:\n{output}"
        )
        assert "执行过程" in output

    @patch("text_to_sql.main.build_agent")
    def test_debug_shows_sql_retry(self, mock_build_agent):
        """Verify that SQL retry attempts are visible in debug mode."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()

        ai_call_1 = AIMessage(content="")
        ai_call_1.tool_calls = [
            {
                "name": "execute_sql_tool",
                "id": "c1",
                "args": {"query": "SELECTT * FROM wrong"},
            }
        ]
        err_msg = ToolMessage(
            content='SQL 执行出错：near "SELECTT": syntax error', tool_call_id="c1"
        )
        ai_call_2 = AIMessage(content="")
        ai_call_2.tool_calls = [
            {
                "name": "execute_sql_tool",
                "id": "c2",
                "args": {"query": "SELECT * FROM funds"},
            }
        ]
        tool_ok = ToolMessage(content="3 rows", tool_call_id="c2")
        ai_final = AIMessage(content="共有3只基金。")

        mock_agent.stream.return_value = [
            {"agent": {"messages": [ai_call_1]}},
            {"tools": {"messages": [err_msg]}},
            {"agent": {"messages": [ai_call_2]}},
            {"tools": {"messages": [tool_ok]}},
            {"agent": {"messages": [ai_final]}},
        ]

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "thread-1", test_console, debug=True)

        output = buf.getvalue()
        assert "SELECTT" in output, f"First (bad) SQL should appear:\n{output}"
        assert "syntax error" in output, f"Error should appear:\n{output}"
        assert "SELECT * FROM funds" in output, f"Retry SQL should appear:\n{output}"

    @patch("text_to_sql.main.build_agent")
    def test_non_debug_uses_invoke(self, mock_build_agent):
        """Verify that non-debug mode uses invoke."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()
        mock_agent.invoke.return_value = {
            "messages": [
                HumanMessage("q"),
                AIMessage(content="answer"),
            ]
        }

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "thread-1", test_console, debug=False)

        mock_agent.invoke.assert_called_once()
        mock_agent.stream.assert_not_called()

    @patch("text_to_sql.main.build_agent")
    def test_debug_stream_exception_handled(self, mock_build_agent):
        """Verify that exceptions during streaming are handled gracefully."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()
        mock_agent.stream.side_effect = ConnectionError("network error")

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "thread-1", test_console, debug=True)

        output = buf.getvalue()
        assert "请求失败" in output or "network error" in output

    @patch("text_to_sql.main.build_agent")
    def test_debug_with_multi_tool_calls(self, mock_build_agent):
        """Verify debug shows multiple tool calls (e.g., list_tables then execute_sql)."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()

        ai_list = AIMessage(content="")
        ai_list.tool_calls = [{"name": "list_tables", "id": "c1", "args": {}}]
        tool_list = ToolMessage(
            content="funds: 基金信息\ncompanies: 企业信息", tool_call_id="c1"
        )
        ai_final = AIMessage(content="数据库包含funds和companies等表。")

        mock_agent.stream.return_value = [
            {"agent": {"messages": [ai_list]}},
            {"tools": {"messages": [tool_list]}},
            {"agent": {"messages": [ai_final]}},
        ]

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "有哪些表", "thread-1", test_console, debug=True)

        output = buf.getvalue()
        assert "list_tables" in output
        assert "工具返回" in output

    @patch("text_to_sql.main.build_agent")
    def test_debug_uses_stream_not_invoke(self, mock_build_agent):
        """Debug mode should use stream, not invoke, for real-time output."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()
        mock_agent.stream.return_value = [
            {"agent": {"messages": [AIMessage(content="ok")]}},
        ]

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "thread-1", test_console, debug=True)

        mock_agent.stream.assert_called_once()
        mock_agent.invoke.assert_not_called()

    @patch("text_to_sql.main.build_agent")
    def test_debug_handles_none_node_update(self, mock_build_agent):
        """stream may return chunks with None values (e.g. edge transitions)."""
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()

        ai_call = AIMessage(content="")
        ai_call.tool_calls = [
            {"name": "execute_sql_tool", "id": "c1", "args": {"query": "SELECT 1"}}
        ]
        tool_result = ToolMessage(content="1", tool_call_id="c1")
        ai_final = AIMessage(content="结果是1。")

        mock_agent.stream.return_value = [
            {"agent": {"messages": [ai_call]}},
            {"__end__": None},
            {"tools": {"messages": [tool_result]}},
            {"agent": None},
            {"agent": {"messages": [ai_final]}},
        ]

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "thread-1", test_console, debug=True)

        output = buf.getvalue()
        assert "SELECT 1" in output, f"SQL should appear despite None chunks:\n{output}"
        assert "1" in output, f"Tool result should appear:\n{output}"
        assert "结果是1" in output, f"Final answer should appear:\n{output}"


# ── Entry point: --debug flag routing ─────────────────────────────


class TestDebugFlagRouting:
    """Verify that --debug from sys.argv reaches _process_query regardless of call path."""

    @patch("text_to_sql.main.build_agent")
    def test_console_script_entry_point_passes_debug(self, mock_build_agent):
        """
        Reproduce the real bug: pyproject.toml entry point calls main()
        without args, so debug=False by default even if --debug is in sys.argv.
        """
        from text_to_sql.main import _parse_debug, _process_query

        mock_agent = MagicMock()
        mock_agent.stream.return_value = [
            {"agent": {"messages": [AIMessage(content="ok")]}},
        ]

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "t", test_console, debug=True)
        debug_output = buf.getvalue()

        assert "执行过程" in debug_output, (
            f"debug=True should show trace, but got:\n{debug_output}"
        )

    @patch("text_to_sql.main.build_agent")
    def test_console_script_entry_point_no_debug(self, mock_build_agent):
        from text_to_sql.main import _process_query

        mock_agent = MagicMock()
        mock_agent.invoke.return_value = {
            "messages": [HumanMessage("q"), AIMessage(content="ok")]
        }

        buf = io.StringIO()
        test_console = Console(file=buf, force_terminal=True, width=120)

        _process_query(mock_agent, "q", "t", test_console, debug=False)
        output = buf.getvalue()

        assert "执行过程" not in output, "non-debug mode should NOT show trace"

    def test_parse_debug_detects_flag_in_argv(self):
        """_parse_debug should return True when --debug is in sys.argv."""
        from text_to_sql.main import _parse_debug

        with patch.object(sys, "argv", ["text-to-sql", "--debug"]):
            assert _parse_debug() is True

    def test_parse_debug_false_without_flag(self):
        """_parse_debug should return False when --debug is NOT in sys.argv."""
        from text_to_sql.main import _parse_debug

        with patch.object(sys, "argv", ["text-to-sql"]):
            assert _parse_debug() is False

    def test_parse_debug_false_when_explicit_false(self):
        """_parse_debug(param=False) with --debug in argv should still be True."""
        from text_to_sql.main import _parse_debug

        with patch.object(sys, "argv", ["text-to-sql", "--debug"]):
            assert _parse_debug() is True

    @patch("text_to_sql.main.build_agent")
    @patch("text_to_sql.main.console")
    def test_main_uses_sys_argv_debug(self, mock_console, mock_build_agent):
        """
        End-to-end: main() called with no explicit debug arg should still
        read --debug from sys.argv.
        """
        from text_to_sql.main import main
        import threading

        mock_agent = MagicMock()
        mock_build_agent.return_value = mock_agent

        # Make console.input raise EOFError to exit the REPL immediately
        mock_console.input.side_effect = EOFError

        with patch.object(sys, "argv", ["text-to-sql", "--debug"]):
            main()

        # Verify DEBUG 模式已开启 was printed
        calls = [str(c) for c in mock_console.print.call_args_list]
        assert any("DEBUG" in c for c in calls), (
            f"Expected 'DEBUG' in console output, got:\n{calls}"
        )
