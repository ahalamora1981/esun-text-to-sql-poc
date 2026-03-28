# Text-to-SQL PoC 完整实施计划

## 一、项目概述

基于会议纪要（Matrix VC 风投机构需求），实现第一阶段 PoC：**基于内部数据库的自然语言查询能力（Text-to-SQL 方向）**。

用户通过自然语言提问，系统自动将问题转换为 SQL 查询，执行后以自然语言返回结果。例如：

- "星辰基金上一季度总收入是多少？"
- "哪些企业本季度净利润增长率最高？"
- "XX LP 的实缴总额是多少？"

### 边界约束

- 以结构化字段查询和数字提取为主，避免过度复杂的模糊语义理解
- 不做多系统联动，暂不引入 RAG
- 暂不处理细粒度权限（统一视为高权限内部用户）
- 本阶段仅实现后端 + 命令行客户端

---

## 二、技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 包管理 | uv | Python 项目管理 |
| Python | 3.12+ | |
| AI 框架 | LangChain v1 | `create_agent` + middleware 架构 |
| LLM 接口 | langchain-openai `ChatOpenAI` | OpenAI 兼容 API（vLLM 自定义 base_url） |
| 数据库 | SQLite | Python 内置 sqlite3 模块 |
| CLI | rich | 带颜色的 REPL 交互界面 |
| 测试 | pytest | |

### 依赖清单

```
# 核心依赖
langchain>=1.1           # create_agent, messages, tools, middleware
langchain-openai         # ChatOpenAI
python-dotenv            # .env 配置加载
rich                     # CLI 交互界面
pydantic                 # 结构化输出
pydantic-settings        # Settings 配置管理

# 开发依赖
pytest
```

> 不使用 `langchain-classic`、`langchain-community`，保持最小依赖。

---

## 三、项目结构

```
text-to-sql-poc/
├── .env.example                 # LLM 配置模板
├── .env                         # 用户手工填入（gitignore）
├── SPEC.md                      # 技术实施规范
├── pyproject.toml               # uv 项目配置
├── src/
│   └── text_to_sql/
│       ├── __init__.py
│       ├── main.py              # CLI REPL 入口，整合所有组件
│       ├── config.py            # Settings：加载 .env 中的 LLM 配置
│       ├── db.py                # SQLite 连接、schema 提取、SQL 执行
│       ├── agent.py             # create_agent 组装 + tools 定义
│       ├── prompts.py           # base system prompt 模板
│       └── middleware/
│           ├── __init__.py
│           ├── schema_prompt.py     # @dynamic_prompt：注入 DDL + sample rows
│           ├── question_guard.py    # before_model：LLM 相关性判断 + 追问
│           └── sql_retry.py         # wrap_tool_call：错误反馈重试
├── data/
│   ├── init_db.py              # 初始化测试数据库（建表 + 插入测试数据）
│   └── vc_test.db              # 生成的 SQLite 数据库文件
└── tests/
    ├── conftest.py             # pytest fixtures
    ├── test_tools.py           # tools 单元测试
    └── test_middleware.py      # middleware 单元测试
```

---

## 四、测试数据库设计

模拟 VC 机构核心业务数据，设计 7 张表：

### 4.1 表结构

#### funds（基金基本信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 基金 ID |
| name | TEXT NOT NULL | 基金名称（如"星辰成长基金"） |
| fund_type | TEXT | 类型：VC / PE / FOF |
| size | REAL | 基金规模（亿元） |
| establishment_date | TEXT | 成立日期 |
| currency | TEXT | 币种：CNY / USD |
| status | TEXT | 状态：募集中 / 投资中 / 退出期 / 已关闭 |

#### companies（被投企业信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 企业 ID |
| name | TEXT NOT NULL | 企业名称 |
| industry | TEXT | 行业（如"人工智能"、"新能源"） |
| region | TEXT | 地区（如"北京"、"上海"、"深圳"） |
| stage | TEXT | 投资阶段：天使 / Pre-A / A / B / C / D / Pre-IPO |
| status | TEXT | 状态：在营 / 已上市 / 已退出 / 已关闭 |

#### fund_investments（基金投资记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 记录 ID |
| fund_id | INTEGER FK → funds | 投资基金 |
| company_id | INTEGER FK → companies | 被投企业 |
| amount | REAL | 投资金额（亿元） |
| investment_date | TEXT | 投资日期 |
| share_pct | REAL | 持股比例（%） |
| valuation | REAL | 投资时估值（亿元） |
| round | TEXT | 投资轮次 |

#### shareholders（LP / 股东信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 股东 ID |
| name | TEXT NOT NULL | 名称（如"XX保险资管"） |
| shareholder_type | TEXT | 类型：机构 / 个人 / 政府 / 母基金 |
| contact_person | TEXT | 联系人 |
| commitment_amount | REAL | 总认缴金额（亿元） |

#### fund_shareholders（基金-LP 关系）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 记录 ID |
| fund_id | INTEGER FK → funds | 基金 |
| shareholder_id | INTEGER FK → shareholders | LP |
| commitment | REAL | 认缴金额（亿元） |
| paid_in | REAL | 实缴金额（亿元） |
| share_pct | REAL | 占比（%） |
| join_date | TEXT | 入伙日期 |

#### quarterly_reports（季度报告数据）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 记录 ID |
| fund_id | INTEGER FK → funds | 基金 |
| year | INTEGER | 年份 |
| quarter | INTEGER | 季度（1-4） |
| total_aum | REAL | 总资产管理规模（亿元） |
| nav | REAL | 净值（元） |
| return_rate | REAL | 收益率（%） |
| invested_amount | REAL | 累计投资金额（亿元） |
| summary | TEXT | 季度概要（文本） |

#### financial_statements（企业财务数据）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 记录 ID |
| company_id | INTEGER FK → companies | 企业 |
| year | INTEGER | 年份 |
| quarter | INTEGER | 季度（1-4） |
| revenue | REAL | 营业收入（亿元） |
| net_income | REAL | 净利润（亿元） |
| total_assets | REAL | 总资产（亿元） |
| total_liabilities | REAL | 总负债（亿元） |
| employee_count | INTEGER | 员工人数 |

### 4.2 测试数据规模

- 3 只基金（星辰成长基金 VC、恒远 PE 基金 PE、星曜 FOF）
- 5 家被投企业（智能科技、绿能新材、云数科技、量子生物、星途导航）
- 4 个 LP（国盛保险、鹏程资管、创新母基金、张明）
- 20+ 条投资记录
- 12 条季度报告（3 基金 × 4 季度）
- 30+ 条财务数据（5 企业 × 多季度）

---

## 五、核心架构：基于 `create_agent` + Middleware

### 5.1 整体处理流程

```
用户输入自然语言问题
  │
  ▼
┌─────────────────────────────────────────────────────┐
│ create_agent                                         │
│                                                      │
│  1. @dynamic_prompt (schema_prompt)                  │
│     → 注入 DDL + sample rows 到 system prompt         │
│                                                      │
│  2. before_model (question_guard)                    │
│     → 规则判断：明显不相关 → 拦截返回拒绝             │
│     → 规则判断：代词/指代不明 → LLM 结合历史改写      │
│     → 通过 → agent 正常执行                           │
│                                                      │
│  3. model (ChatOpenAI instance)                      │
│     → 决定调用 tool 或直接回答                        │
│     → tools: execute_sql, list_tables                │
│                                                      │
│  4. wrap_tool_call (sql_retry)                       │
│     → SQL 错误 → 返回错误 ToolMessage                │
│     → agent loop 自动让 model 重试                    │
│     → 超过 max_retries → 返回友好错误提示             │
│                                                      │
│  5. model 看到工具结果 → 生成自然语言最终回答          │
└─────────────────────────────────────────────────────┘
  │
  ▼
输出自然语言回答给用户
```

### 5.2 Tools 定义（agent.py）

#### `execute_sql`

```python
from langchain.tools import tool

@tool
def execute_sql(query: str) -> str:
    """执行 SQL 查询并返回结果。仅支持 SELECT 查询，不支持 INSERT/UPDATE/DELETE/DROP。"""
```

- 安全检查：仅允许 `SELECT` 开头的 SQL（通过正则校验，不区分大小写）
- 执行查询，返回格式化结果（表头 + 数据行）
- 空结果返回 `"查询结果为空。"` 而非空字符串
- 异常由 `sql_retry` middleware 的 `wrap_tool_call` 处理

#### `list_tables`

```python
@tool
def list_tables() -> str:
    """列出数据库中所有可用的表及其简要说明。"""
```

- 返回表名 + 中文说明，帮助 agent 和用户了解可查询范围

### 5.3 Middleware 设计

> **LangChain v1 API 参考**：
> - `before_model` 是 node-style hook，签名为 `(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None`
> - `wrap_tool_call` 是 wrap-style hook，签名为 `(self, request: ToolCallRequest, handler) -> ToolMessage | Command`
> - `@dynamic_prompt` 签名为 `(request: ModelRequest) -> str`
> - `jump_to` 需通过 `@hook_config(can_jump_to=["end"])` 声明

#### `@dynamic_prompt`（schema_prompt.py）

**职责**：将数据库 schema 信息注入 system prompt。

- 使用 `@dynamic_prompt` 装饰器
- 从 `db.py` 提取所有表的 `CREATE TABLE` DDL
- 提取每张表前 3 行 sample data
- 拼接到 system prompt 的 schema 部分

```python
from langchain.agents.middleware import dynamic_prompt, ModelRequest

@dynamic_prompt
def inject_schema(request: ModelRequest) -> str:
    ddl = get_all_ddl()
    samples = get_sample_rows()
    return BASE_SYSTEM_PROMPT.format(schema=ddl, samples=samples)
```

#### `QuestionGuardMiddleware`（question_guard.py）

**职责**：在 model 调用前，通过 LLM 判断用户问题是否与 VC 业务相关。不使用硬编码关键词列表。

继承 `AgentMiddleware`，实现 `before_model` hook：

1. **LLM 相关性判断**：
   - 将用户问题 + 对话历史发送给 LLM 分类器
   - LLM 返回三种标签：`RELEVANT` / `IRRELEVANT` / `NEED_CLARIFICATION: <detail>`
   - `RELEVANT` → 放行，返回 `None`
   - `IRRELEVANT` → 通过 `{"messages": [AIMessage("...")], "jump_to": "end"}` 拦截
   - `NEED_CLARIFICATION` → 追问用户补充信息，返回 `{"messages": [AIMessage("...")], "jump_to": "end"}`
   - 需通过 `@hook_config(can_jump_to=["end"])` 装饰器启用 `jump_to`

2. **容错**：
   - LLM 异常 → 保守放行（不拦截），返回 `None`
   - LLM 返回未知标签 → 保守放行

**实现要点**：

```python
from langchain.agents.middleware import AgentMiddleware, hook_config
from langchain.agents import AgentState
from langchain.messages import HumanMessage, AIMessage
from langgraph.runtime import Runtime
from typing import Any

JUDGE_SYSTEM_PROMPT = """你是一个判断用户问题是否与VC（风险投资）业务相关的分类器。
...（包含业务范围说明、判断规则、格式要求）
请只返回：RELEVANT / IRRELEVANT / NEED_CLARIFICATION: <detail>"""


class QuestionGuardMiddleware(AgentMiddleware):

    def _judge_question(self, question: str, history: list) -> str:
        # 调用 LLM 判断相关性
        ...

    @hook_config(can_jump_to=["end"])
    def before_model(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
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
            return None  # LLM 失败 → 保守放行

        if judgment.startswith("RELEVANT"):
            return None
        if judgment.startswith("IRRELEVANT"):
            return {"messages": [AIMessage("抱歉...")], "jump_to": "end"}
        if judgment.startswith("NEED_CLARIFICATION"):
            # 追问用户补充信息
            ...
        return None  # 未知标签 → 保守放行
```

#### `SqlRetryMiddleware`（sql_retry.py）

**职责**：处理 SQL 执行错误，通过返回错误 ToolMessage 让 agent loop 自动重试。

> **设计说明**：不采用温度递增方案。`wrap_tool_call` 返回包含错误信息的 `ToolMessage` 后，
> LangChain agent loop 会自动将该 `ToolMessage` 发送给 model，model 会基于错误信息修正 SQL 并重试。
> 只需通过计数器限制最大重试次数，避免无限循环。

继承 `AgentMiddleware`，实现 `wrap_tool_call` hook：

| 错误类型 | 处理方式 |
|----------|----------|
| `sqlite3.OperationalError` | 返回错误 `ToolMessage`，agent loop 自动重试，计数器 +1 |
| 查询结果为空 | 不重试，由 `execute_sql` tool 直接返回友好提示 |
| `sqlite3.Error`（其他数据库错误） | 返回错误信息，不重试 |
| `Exception`（非数据库错误） | 直接抛出，不重试 |
| 超过 `max_retries` | 返回友好错误提示，建议换种问法 |

**实现**：

```python
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

        call_id = request.tool_call["id"]
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
```

### 5.4 对话历史

- `create_agent` 基于 LangGraph，天然支持消息历史
- 使用 `InMemorySaver` 作为 checkpointer，对话历史在内存中维护
- 每次 `agent.invoke()` 时需传入 `config={"configurable": {"thread_id": "<session_id>"}}`
- `before_model` 中的 `QuestionGuardMiddleware` 通过 `state["messages"]` 访问最近对话历史
- `/clear` 命令通过生成新的 `thread_id` 来清空对话历史

### 5.5 Agent 组装（agent.py）

```python
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

model = ChatOpenAI(
    base_url=settings.openai_base_url,
    api_key=settings.openai_api_key,
    model=settings.openai_model,
    temperature=0.0,
)

agent = create_agent(
    model=model,
    tools=[execute_sql, list_tables],
    system_prompt=SYSTEM_PROMPT,
    middleware=[
        inject_schema,
        QuestionGuardMiddleware(),
        SqlRetryMiddleware(max_retries=3),
    ],
    checkpointer=InMemorySaver(),
)
```

### 5.6 System Prompt 设计（prompts.py）

```
你是一个风险投资（VC）机构的内部数据分析助手。你的职责是根据用户的自然语言问题，
查询内部数据库并以清晰的自然语言返回结果。

## 数据库说明
{schema}

## 示例数据
{samples}

## 规则
1. 只执行 SELECT 查询，绝不执行 INSERT/UPDATE/DELETE/DROP 等修改操作
2. 优先使用 list_tables 工具了解可用的表
3. 生成 SQL 前仔细核对表名和字段名，注意 SQLite 语法
4. 返回结果时用自然语言总结关键数据，不要只返回原始数字
5. 如果查询结果为空，告知用户未找到匹配数据
6. 金额单位统一为"亿元"，百分比保留 2 位小数
7. 如果用户的问题不够清晰，结合上下文合理推断
8. 如果收到 SQL 执行错误，仔细分析错误原因并修正 SQL 重试
```

---

## 六、配置管理（config.py + .env）

### .env.example

```
# LLM 配置（vLLM OpenAI 兼容格式）
OPENAI_API_KEY=None
OPENAI_BASE_URL=http://10.101.100.11:8017/v1
OPENAI_MODEL=/models/Qwen3.5-27B-UD-Q8_K_XL.gguf

# 可选：数据库路径
DB_PATH=data/vc_test.db
```

### config.py

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = "None"
    openai_base_url: str = "http://10.101.100.11:8017/v1"
    openai_model: str = "/models/Qwen3.5-27B-UD-Q8_K_XL.gguf"
    db_path: str = "data/vc_test.db"

    model_config = {"env_file": ".env", "env_prefix": ""}
```

---

## 七、CLI 交互（main.py）

使用 `rich` 库实现带颜色的 REPL 交互界面。

### 交互命令

| 命令 | 说明 |
|------|------|
| 直接输入文本 | 提交自然语言查询 |
| `/quit` | 退出程序 |
| `/clear` | 清空对话历史（生成新 thread_id） |
| `/tables` | 查看所有表名及说明 |
| `/schema` | 查看完整 DDL |
| `/help` | 显示帮助信息 |

### CLI 流程

1. 启动时加载 `.env`，初始化数据库连接
2. 组装 `create_agent`（tools + middleware + checkpointer）
3. 生成初始 `thread_id`（uuid4）
4. 进入 REPL 循环：
   - 读取用户输入
   - 处理命令（/quit, /clear, /tables, /schema, /help）
   - `/clear` → 生成新的 `thread_id`
   - 普通文本 → `agent.invoke({"messages": [HumanMessage(input)]}, config={"configurable": {"thread_id": thread_id}})`
   - 输出最终回答（从 `result["messages"]` 取最后一条 `AIMessage`）
5. 支持 `agent.stream()` 流式输出（可选，视体验需求）

---

## 八、错误处理策略

| 错误类型 | 处理方式 | 负责模块 |
|----------|----------|----------|
| 问题不相关（与 VC 业务无关） | LLM 判断 IRRELEVANT，委婉拒绝 | `question_guard` |
| 问题可能相关但缺少上下文 | LLM 判断 NEED_CLARIFICATION，追问用户补充信息 | `question_guard` |
| SQL 语法错误 | 返回错误 ToolMessage，agent loop 自动重试，最多 3 次 | `sql_retry` |
| SQL 运行时错误（表/列不存在） | 同上 | `sql_retry` |
| 查询结果为空 | `execute_sql` 返回"查询结果为空" | `execute_sql` tool |
| 非 SELECT 语句 | `execute_sql` tool 内拒绝执行，返回错误 | `execute_sql` tool |
| 数据库连接失败 | 直接报错，提示检查配置 | `execute_sql` tool |
| LLM API 调用失败 | 报错，不重试 | LangChain 内置处理 |
| 所有 SQL 重试耗尽 | 返回友好提示，建议换种问法 | `sql_retry` |

---

## 九、TDD 开发规范

本项目采用 **测试驱动开发（TDD）** 流程，所有新功能和 bug 修复都必须遵循 Red → Green → Refactor 循环。

### 9.1 流程要求

| 阶段 | 要求 |
|------|------|
| **Red** | 先编写失败的测试用例，覆盖预期行为和边界情况，运行确认测试失败 |
| **Green** | 编写最小量的代码使测试通过，不写测试未要求的功能 |
| **Refactor** | 在测试全绿的前提下重构代码，每次重构后重新运行测试确保无回归 |

### 9.2 约束

- **禁止跳过测试**：不允许先写实现再补测试，也不允许在测试不通过时跳过测试继续开发
- **禁止提交失败测试**：每次提交前必须运行 `uv run pytest tests/ -v`，确保全部通过
- **测试覆盖边界**：每个功能模块的正常路径、异常路径、边界条件都应有对应测试
- **Mock 外部依赖**：LLM 调用、网络请求等外部依赖使用 `unittest.mock` 隔离，确保测试快速且确定
- **命名规范**：测试方法名以 `test_` 开头，使用描述性名称表达测试意图（如 `test_no_keywords_multiturn_triggers_llm_rewrite`）

### 9.3 执行命令

```bash
# 运行全部测试
uv run pytest tests/ -v

# 运行单个测试文件
uv run pytest tests/test_middleware.py -v

# 运行单个测试类
uv run pytest tests/test_middleware.py::TestQuestionGuard -v

# 运行单个测试方法
uv run pytest tests/test_middleware.py::TestQuestionGuard::test_no_keywords_multiturn_triggers_llm_rewrite -v
```

---

## 十、实现步骤

| 步骤 | 内容 | 产出 |
|------|------|------|
| **1** | 项目初始化：`uv init`，配置 `pyproject.toml`，创建 `.env.example`，安装依赖 | 可运行的空项目 |
| **2** | 编写 `data/init_db.py`：7 张表 DDL + 测试数据，生成 `vc_test.db` | 测试数据库 |
| **3** | 实现 `config.py` + `db.py`：Settings 加载、SQLite 连接、DDL 提取、sample rows 提取、SQL 执行 | 基础设施层 |
| **4** | 实现 `prompts.py` + `middleware/schema_prompt.py`：base system prompt + `@dynamic_prompt` | schema 注入 |
| **5** | 实现 `middleware/question_guard.py`：LLM 相关性判断 + 追问 | 输入质量控制 |
| **6** | 实现 `agent.py`：tools 定义（`execute_sql` + `list_tables`）+ `create_agent` 组装 | Agent 核心 |
| **7** | 实现 `middleware/sql_retry.py`：`wrap_tool_call` 错误反馈 + 重试计数 | 错误处理 |
| **8** | 实现 `main.py`：CLI REPL（rich），整合 agent + checkpointer + thread_id 管理 | 用户交互入口 |
| **9** | 编写 `tests/`：tools 测试、middleware 测试 | 测试覆盖 |

---

## 十一、测试计划

### test_tools.py（9 个用例）

数据库操作与 SQL 安全检查：

- `test_get_connection`：验证数据库连接正常建立
- `test_get_all_ddl`：验证能提取所有表的 DDL
- `test_get_sample_rows`：验证能获取示例数据行
- `test_get_sample_rows_invalid_table`：验证不存在的表返回空列表
- `test_get_all_sample_rows`：验证能获取所有表的示例数据文本
- `test_select_query`：验证 SELECT 查询正常执行并返回结果
- `test_select_empty_result`：验证空结果返回"查询结果为空"
- `test_non_select_blocked`：验证非 SELECT 语句（DELETE）被拒绝
- `test_select_with_aggregation`：验证聚合查询正常执行

### test_middleware.py（23 个用例）

#### QuestionGuardMiddleware — before_model 决策（13 个）

所有相关性判断均由 LLM 完成，不使用硬编码关键词列表。LLM 返回三种标签：`RELEVANT` / `IRRELEVANT` / `NEED_CLARIFICATION`。

- `test_empty_question_ignored`：空字符串不处理
- `test_non_human_message_ignored`：非 HumanMessage 不处理
- `test_relevant_question_passes`：LLM 返回 RELEVANT → 放行
- `test_relevant_with_extra_text_still_passes`：LLM 返回 "RELEVANT: 备注" → 仍放行
- `test_irrelevant_question_blocked`：LLM 返回 IRRELEVANT → 拦截（jump_to end）
- `test_irrelevant_multiturn_blocked`：多轮对话中问无关问题 → 拦截
- `test_need_clarification_returns_ask_message`：LLM 返回 NEED_CLARIFICATION: <detail> → 追问用户
- `test_need_clarification_without_detail_uses_default`：NEED_CLARIFICATION 无 detail → 使用默认追问消息
- `test_multiturn_no_keywords_relevant`：多轮追问（如"那么下半年呢？"）LLM 判断 RELEVANT → 放行
- `test_multiturn_ambiguous_asks_clarification`：多轮对话中问题仍模糊 → LLM 判断 NEED_CLARIFICATION → 追问
- `test_llm_failure_conservatively_passes`：LLM 异常 → 保守放行（不拦截）
- `test_unknown_judgment_conservatively_passes`：LLM 返回未知标签 → 保守放行
- `test_judge_receives_question_and_history`：验证 `_judge_question` 收到当前问题和历史（不含当前问题）

#### QuestionGuardMiddleware — _judge_question LLM 交互（5 个）

- `test_returns_relevant`：LLM 返回 "RELEVANT"
- `test_returns_irrelevant`：LLM 返回 "IRRELEVANT"
- `test_returns_need_clarification_with_detail`：LLM 返回 "NEED_CLARIFICATION: ..."
- `test_prompt_contains_history`：LLM prompt 包含对话历史上下文
- `test_llm_exception_propagates`：LLM 异常向上传播

#### SqlRetryMiddleware（5 个）

- `test_non_sql_tool_passes_through`：非 SQL 工具调用直接透传
- `test_success_clears_counter`：首次成功清除重试计数器
- `test_operational_error_retries`：SQL OperationalError 返回错误 ToolMessage 并递增计数
- `test_max_retries_exhausted`：超过 max_retries 返回友好错误提示
- `test_generic_sql_error_no_retry`：非 OperationalError 的数据库错误不重试

### test_debug.py（28 个用例）

#### _extract_content（5 个）

- `test_string_content`：字符串内容直接返回
- `test_empty_string_content`：空字符串返回空
- `test_list_content_text_dict`：content 为 list[dict] 时提取 text 字段
- `test_list_content_mixed_dict_and_str`：混合 dict 和 str 元素的 list
- `test_list_content_non_text_dict`：非 text 类型的 dict 元素

#### _get_final_response（4 个）

- `test_returns_last_ai_without_tool_calls`：返回最后一条无 tool_calls 的 AIMessage
- `test_skips_ai_messages_with_tool_calls`：跳过带 tool_calls 的 AIMessage
- `test_returns_none_when_no_ai_message`：无 AIMessage 时返回 None
- `test_returns_none_for_empty_messages`：消息列表为空时返回 None

#### _print_debug（8 个）

- `test_human_message_printed`：HumanMessage 显示 [USER] 标签
- `test_ai_with_sql_tool_call_shows_query`：SQL 工具调用显示 SQL 查询面板
- `test_ai_with_list_tables_tool_call`：list_tables 工具调用显示工具名
- `test_ai_plain_text_shows_thinking`：AI 纯文本内容显示 [THINK] 标签
- `test_ai_empty_content_no_output`：AI 空内容不输出
- `test_tool_message_shows_result`：ToolMessage 显示工具返回面板
- `test_tool_message_with_name`：带 name 的 ToolMessage 显示工具名
- `test_multiple_messages`：多消息序列正确渲染

#### Debug Stream 集成（5 个）

- `test_debug_shows_sql_and_result`：debug 模式下 SQL 查询和结果都可见
- `test_debug_shows_sql_retry`：SQL 重试过程可见（错误 SQL → 修正 SQL）
- `test_non_debug_uses_invoke_not_stream`：非 debug 模式使用 invoke 而非 stream
- `test_debug_stream_exception_handled`：流式异常被优雅处理
- `test_debug_with_multi_tool_calls`：多工具调用场景正确显示

#### Debug Flag 路由（6 个）

- `test_console_script_entry_point_passes_debug`：debug=True 时显示执行过程
- `test_console_script_entry_point_no_debug`：debug=False 时不显示执行过程
- `test_parse_debug_detects_flag_in_argv`：`_parse_debug()` 正确识别 `--debug`
- `test_parse_debug_false_without_flag`：无 `--debug` 时返回 False
- `test_parse_debug_false_when_explicit_false`：有 `--debug` 时返回 True
- `test_main_uses_sys_argv_debug`：`main()` 无显式参数时从 `sys.argv` 读取 debug 标志
