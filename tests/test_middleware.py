import os
import tempfile
import pytest
from unittest.mock import MagicMock, patch

from langchain.messages import HumanMessage, AIMessage
from langchain.tools.tool_node import ToolCallRequest
from langchain.messages import ToolMessage

from text_to_sql.config import Settings
from text_to_sql.middleware.question_guard import QuestionGuardMiddleware
from text_to_sql.middleware.sql_retry import SqlRetryMiddleware


# ── before_model 决策逻辑 ───────────────────────────────────────


class TestQuestionGuardBeforeModel:
    def setup_method(self):
        self.guard = QuestionGuardMiddleware()

    def _make_state(self, messages):
        return {"messages": messages}

    # --- 基础输入验证 ---

    def test_empty_question_ignored(self):
        state = self._make_state([HumanMessage("")])
        result = self.guard.before_model(state, runtime=None)
        assert result is None

    def test_non_human_message_ignored(self):
        state = self._make_state([AIMessage("some response")])
        result = self.guard.before_model(state, runtime=None)
        assert result is None

    # --- RELEVANT: 放行 ---

    @patch.object(QuestionGuardMiddleware, "_judge_question", return_value="RELEVANT")
    def test_relevant_question_passes(self, _mock):
        state = self._make_state([HumanMessage("星辰基金的规模是多少")])
        result = self.guard.before_model(state, runtime=None)
        assert result is None

    @patch.object(
        QuestionGuardMiddleware, "_judge_question", return_value="RELEVANT: 备注"
    )
    def test_relevant_with_extra_text_still_passes(self, _mock):
        state = self._make_state([HumanMessage("星辰基金")])
        result = self.guard.before_model(state, runtime=None)
        assert result is None

    # --- IRRELEVANT: 拦截 ---

    @patch.object(QuestionGuardMiddleware, "_judge_question", return_value="IRRELEVANT")
    def test_irrelevant_question_blocked(self, _mock):
        state = self._make_state([HumanMessage("今天天气怎么样")])
        result = self.guard.before_model(state, runtime=None)
        assert result is not None
        assert result.get("jump_to") == "end"
        assert "VC 机构" in result["messages"][0].content

    @patch.object(QuestionGuardMiddleware, "_judge_question", return_value="IRRELEVANT")
    def test_irrelevant_multiturn_blocked(self, _mock):
        messages = [
            HumanMessage("星辰基金的规模是多少"),
            AIMessage("10亿元"),
            HumanMessage("今天中午吃什么"),
        ]
        state = self._make_state(messages)
        result = self.guard.before_model(state, runtime=None)
        assert result is not None
        assert result.get("jump_to") == "end"

    # --- NEED_CLARIFICATION: 追问用户 ---

    @patch.object(
        QuestionGuardMiddleware,
        "_judge_question",
        return_value="NEED_CLARIFICATION: 请指明您想查询哪个基金的收益率",
    )
    def test_need_clarification_returns_ask_message(self, _mock):
        state = self._make_state([HumanMessage("它的收益率呢")])
        result = self.guard.before_model(state, runtime=None)
        assert result is not None
        assert result.get("jump_to") == "end"
        msg = result["messages"][0].content
        assert "更多" in msg
        assert "基金" in msg

    @patch.object(
        QuestionGuardMiddleware,
        "_judge_question",
        return_value="NEED_CLARIFICATION",
    )
    def test_need_clarification_without_detail_uses_default(self, _mock):
        state = self._make_state([HumanMessage("它呢")])
        result = self.guard.before_model(state, runtime=None)
        assert result is not None
        msg = result["messages"][0].content
        assert "缺少" in msg or "具体" in msg

    # --- 多轮追问（用户的核心痛点） ---

    @patch.object(QuestionGuardMiddleware, "_judge_question", return_value="RELEVANT")
    def test_multiturn_no_keywords_relevant(self, _mock):
        """
        '那么下半年呢？' 无关键词但有上下文 → LLM 判断 RELEVANT → 放行。
        """
        messages = [
            HumanMessage("总结星辰成长2024年上半年的季报"),
            AIMessage("星辰成长基金2024年上半年季报如下..."),
            HumanMessage("那么下半年呢？"),
        ]
        state = self._make_state(messages)
        result = self.guard.before_model(state, runtime=None)
        assert result is None

    @patch.object(
        QuestionGuardMiddleware,
        "_judge_question",
        return_value="NEED_CLARIFICATION: 请明确您想查询哪个指标",
    )
    def test_multiturn_ambiguous_asks_clarification(self, _mock):
        """
        多轮对话中问题仍模糊 → LLM 判断 NEED_CLARIFICATION → 追问用户。
        """
        messages = [
            HumanMessage("星辰基金"),
            AIMessage("您想了解星辰基金的什么信息？"),
            HumanMessage("那个"),
        ]
        state = self._make_state(messages)
        result = self.guard.before_model(state, runtime=None)
        assert result is not None
        assert result.get("jump_to") == "end"
        assert "指标" in result["messages"][0].content

    # --- 容错 ---

    @patch.object(
        QuestionGuardMiddleware,
        "_judge_question",
        side_effect=Exception("LLM unavailable"),
    )
    def test_llm_failure_conservatively_passes(self, _mock):
        state = self._make_state([HumanMessage("星辰基金的AUM")])
        result = self.guard.before_model(state, runtime=None)
        assert result is None, "LLM 失败时保守放行"

    @patch.object(QuestionGuardMiddleware, "_judge_question", return_value="MAYBE")
    def test_unknown_judgment_conservatively_passes(self, _mock):
        state = self._make_state([HumanMessage("星辰基金的AUM")])
        result = self.guard.before_model(state, runtime=None)
        assert result is None, "未知判断结果保守放行"

    # --- _judge_question 参数传递 ---

    @patch.object(QuestionGuardMiddleware, "_judge_question", return_value="RELEVANT")
    def test_judge_receives_question_and_history(self, mock_judge):
        messages = [
            HumanMessage("星辰基金的AUM是多少"),
            AIMessage("12亿元"),
            HumanMessage("那么规模呢？"),
        ]
        state = self._make_state(messages)
        self.guard.before_model(state, runtime=None)
        mock_judge.assert_called_once()
        args = mock_judge.call_args[0]
        assert args[0] == "那么规模呢？"
        assert len(args[1]) == 2, "history 应排除当前问题，只有前 2 条消息"


# ── _judge_question LLM 交互 ────────────────────────────────────


class TestJudgeQuestion:
    def setup_method(self):
        self.guard = QuestionGuardMiddleware()

    @patch.object(QuestionGuardMiddleware, "_get_llm")
    def test_returns_relevant(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "RELEVANT"
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        result = self.guard._judge_question("星辰基金的规模", [])
        assert result == "RELEVANT"

    @patch.object(QuestionGuardMiddleware, "_get_llm")
    def test_returns_irrelevant(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "IRRELEVANT"
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        result = self.guard._judge_question("今天天气", [])
        assert result == "IRRELEVANT"

    @patch.object(QuestionGuardMiddleware, "_get_llm")
    def test_returns_need_clarification_with_detail(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "NEED_CLARIFICATION: 请指明具体的基金名称"
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        result = self.guard._judge_question("它的收益率呢", [])
        assert "NEED_CLARIFICATION" in result
        assert "基金名称" in result

    @patch.object(QuestionGuardMiddleware, "_get_llm")
    def test_prompt_contains_history(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "RELEVANT"
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        history = [
            HumanMessage("星辰基金的AUM"),
            AIMessage("12亿"),
        ]
        self.guard._judge_question("那么规模呢", history)

        call_args = mock_llm.invoke.call_args[0][0]
        prompt = call_args[0].content
        assert "星辰基金" in prompt, "LLM prompt 应包含对话历史"

    @patch.object(QuestionGuardMiddleware, "_get_llm")
    def test_llm_exception_propagates(self, mock_get_llm):
        mock_get_llm.side_effect = Exception("connection error")
        with pytest.raises(Exception, match="connection error"):
            self.guard._judge_question("test", [])


# ── SqlRetry（未改动） ──────────────────────────────────────────


class TestSqlRetry:
    def setup_method(self):
        self.middleware = SqlRetryMiddleware(max_retries=3)

    def _make_request(self, tool_name="execute_sql", call_id="call_1"):
        return type(
            "Req", (), {"tool_call": {"name": tool_name, "id": call_id, "args": {}}}
        )()

    def test_non_sql_tool_passes_through(self):
        request = self._make_request(tool_name="list_tables")
        handler = MagicMock(
            return_value=ToolMessage(content="ok", tool_call_id="call_1")
        )
        result = self.middleware.wrap_tool_call(request, handler)
        handler.assert_called_once()

    def test_success_clears_counter(self):
        request = self._make_request()
        handler = MagicMock(
            return_value=ToolMessage(content="ok", tool_call_id="call_1")
        )
        result = self.middleware.wrap_tool_call(request, handler)
        assert "call_1" not in self.middleware._retry_counts

    def test_operational_error_retries(self):
        import sqlite3

        request = self._make_request()
        handler = MagicMock(side_effect=sqlite3.OperationalError("no such table"))

        result = self.middleware.wrap_tool_call(request, handler)
        assert isinstance(result, ToolMessage)
        assert "SQL 执行出错" in result.content
        assert "剩余 3 次机会" in result.content
        assert self.middleware._retry_counts.get("call_1") == 1

    def test_max_retries_exhausted(self):
        import sqlite3

        request = self._make_request()
        self.middleware._retry_counts["call_1"] = 3
        handler = MagicMock()

        result = self.middleware.wrap_tool_call(request, handler)
        assert isinstance(result, ToolMessage)
        assert "多次尝试后仍然失败" in result.content
        handler.assert_not_called()

    def test_generic_sql_error_no_retry(self):
        import sqlite3

        request = self._make_request()
        handler = MagicMock(side_effect=sqlite3.DatabaseError("disk error"))

        result = self.middleware.wrap_tool_call(request, handler)
        assert isinstance(result, ToolMessage)
        assert "数据库错误" in result.content
        assert "call_1" not in self.middleware._retry_counts
