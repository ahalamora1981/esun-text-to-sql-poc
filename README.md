# Text-to-SQL PoC

Matrix VC 风投机构内部数据分析工具。用户通过自然语言提问，系统自动转换为 SQL 查询并执行，以自然语言返回结果。

## 架构

```
cli-client ──► backend (FastAPI + LangChain Agent) ──► SQLite
web-app   ──►        (预留)
```

- **backend** — FastAPI REST API，封装 LangChain Agent（含问题过滤、SQL 重试等中间件），会话持久化到 SQLite
- **cli-client** — 基于 rich 的终端 REPL，通过 HTTP 调用后端 API，支持 `--debug` 模式查看中间过程
- **web-app** — 预留，未来浏览器界面

## 快速开始

```bash
# 1. 初始化测试数据库
cd backend && uv run python data/init_db.py

# 2. 启动后端
cd backend && uv run text-to-sql-server

# 3. 启动 CLI（另一个终端）
cd cli-client && uv run text-to-sql-cli
```

## 技术栈

Python 3.12 / uv / LangChain v1 / FastAPI / SQLite / rich / httpx
