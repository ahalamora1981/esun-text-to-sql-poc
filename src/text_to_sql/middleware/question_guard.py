from typing import Any

from pydantic import SecretStr
from langchain.agents.middleware import AgentMiddleware, hook_config
from langchain.agents import AgentState
from langchain.messages import HumanMessage, AIMessage
from langgraph.runtime import Runtime

from ..config import load_settings
from ..db import TABLE_DESCRIPTIONS

JUDGE_SYSTEM_PROMPT = """你是一个判断用户问题是否与VC（风险投资）机构数据分析业务相关的分类器。

## 业务范围
本系统可查询以下VC业务数据：
{scope}

## 判断规则
1. 如果问题明确与上述业务相关 → 返回 RELEVANT
2. 如果问题与VC业务完全无关 → 返回 IRRELEVANT
3. 仅在以下情况返回 NEED_CLARIFICATION: <需要用户补充的信息>：
   - 这是对话的**第一条消息**，且问题过于简短模糊（如"它呢"、"那个呢"、"AUM呢"），无法判断用户想查什么
   - 有对话历史，但用户问的是**全新的、完全无关的话题**（如从基金数据突然问"明天天气"），此时应返回 IRRELEVANT

重要：代词指代不明（如"它有哪些股东？"）在有对话历史的情况下不属于需要追问的情况，后续agent能结合上下文自动消解。此时应返回 RELEVANT。

## 对话历史
{history}

## 用户最新问题
{question}

请严格只返回以下标签之一（不要加任何解释或额外文字）：
- RELEVANT
- IRRELEVANT
- NEED_CLARIFICATION: <需要用户补充的信息>"""

BUSINESS_SCOPE = "\n".join(f"- {desc}" for desc in TABLE_DESCRIPTIONS.values())


class QuestionGuardMiddleware(AgentMiddleware):
    def __init__(self):
        super().__init__()
        self._settings = load_settings()
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI

            self._llm = ChatOpenAI(
                base_url=self._settings.openai_base_url,
                api_key=SecretStr(self._settings.openai_api_key),
                model=self._settings.openai_model,
                temperature=0.0,
            )
        return self._llm

    def _extract_content(self, msg) -> str:
        c = msg.content
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts = []
            for p in c:
                if isinstance(p, dict):
                    parts.append(p.get("text", ""))
                else:
                    parts.append(str(p))
            return "".join(parts)
        return str(c)

    def _format_history(self, messages: list) -> str:
        lines = []
        for msg in messages:
            if isinstance(msg, HumanMessage):
                lines.append(f"用户: {self._extract_content(msg)}")
            elif isinstance(msg, AIMessage):
                content = self._extract_content(msg)
                if msg.tool_calls and not content:
                    tool_names = [tc.get("name", "?") for tc in msg.tool_calls]
                    content = f"[调用工具: {', '.join(tool_names)}]"
                if content:
                    lines.append(f"助手: {content}")
        return "\n".join(lines) if lines else "（无历史记录）"

    def _judge_question(self, question: str, history: list) -> str:
        llm = self._get_llm()
        prompt = JUDGE_SYSTEM_PROMPT.format(
            scope=BUSINESS_SCOPE,
            history=self._format_history(history),
            question=question,
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        return self._extract_content(response).strip()

    @hook_config(can_jump_to=["end"])
    def before_model(
        self, state: AgentState, runtime: Runtime
    ) -> dict[str, Any] | None:
        messages = state["messages"]
        last_msg = messages[-1]
        if not isinstance(last_msg, HumanMessage):
            return None

        question = self._extract_content(last_msg).strip()
        if not question:
            return None

        history = messages[:-1]

        try:
            judgment = self._judge_question(question, history)
        except Exception:
            return None

        if judgment.startswith("RELEVANT"):
            return None

        if judgment.startswith("IRRELEVANT"):
            return {
                "messages": [
                    AIMessage(
                        "抱歉，我是一个 VC 机构内部数据分析助手，"
                        "只支持基金、投资、企业财务等业务相关的数据查询。"
                        "请尝试提出与 VC 业务相关的问题。"
                    )
                ],
                "jump_to": "end",
            }

        if judgment.startswith("NEED_CLARIFICATION"):
            detail = judgment.split(":", 1)[1].strip() if ":" in judgment else ""
            if detail:
                msg = f"我需要更多信息来回答您的问题：{detail}\n\n您可以告诉我具体想查询哪个基金、企业或指标吗？"
            else:
                msg = "您的问题缺少一些必要的信息。您可以告诉我具体想查询哪个基金、企业或指标吗？"
            return {
                "messages": [AIMessage(msg)],
                "jump_to": "end",
            }

        return None
