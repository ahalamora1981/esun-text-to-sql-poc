# Text-to-SQL PoC

Matrix VC 风投机构内部数据分析工具。用户通过自然语言提问，系统自动转换为 SQL 查询并执行，以自然语言返回结果。

面向投资经理、分析师、LP 关系人员等内部用户，覆盖基金管理、投资组合、LP 出资、企业财务等 VC 核心业务数据域。

## 功能特性

- **自然语言查询** — 输入中文问题，如"星辰成长基金投资了哪些公司"、"各基金 AUM 排名"
- **多轮对话** — 支持追问，自动消解代词指代（先问"星辰基金的规模"，再问"它的收益率呢"）
- **智能过滤** — 与 VC 业务无关的问题会被拒绝，信息不足时主动追问
- **SQL 安全** — 仅允许 SELECT 查询，自动拦截写操作
- **错误重试** — SQL 执行出错自动修正重试（最多 3 次）
- **Debug 模式** — CLI `--debug` 和 Web 端开关，实时查看生成的 SQL 和工具调用过程
- **Web 界面** — React SPA，SSE 流式响应，Token 认证，会话管理

## 覆盖数据域

| 数据域 | 说明 |
|--------|------|
| 基金信息 | 名称、类型(VC/PE/FOF)、规模、状态 |
| 被投企业 | 行业、地区、投资阶段 |
| 投资记录 | 金额、估值、持股比例、轮次 |
| LP / 股东 | 认缴金额、实缴金额、占比 |
| 季度报告 | AUM、净值、收益率 |
| 企业财务 | 营收、净利润、总资产、总负债 |

## 架构

```
cli-client ──► backend (FastAPI + LangChain Agent) ──► SQLite
web-app   ──►        (SSE 流式响应)
```

- **backend** — FastAPI REST API，封装 LangChain Agent（含问题过滤、SQL 重试等中间件），会话持久化到 SQLite
- **cli-client** — 基于 rich 的终端 REPL，通过 HTTP 调用后端 API
- **web-app** — React 19 SPA，SSE 流式通信，Token 认证，支持会话管理与 Debug 模式

## 快速开始

```bash
# 1. 初始化测试数据库
cd backend && uv run python data/init_db.py

# 2. 启动后端
cd backend && uv run text-to-sql-server

# 3. 启动 CLI（另一个终端）
cd cli-client && uv run text-to-sql-cli

# 4. 启动 Web 应用（另一个终端）
cd web-app && npm install && npm run dev
```

## 技术栈

Python 3.12 / uv / LangChain v1 / FastAPI / SQLite / rich / httpx / React 19 / TypeScript / Vite 8 / Tailwind CSS 4
