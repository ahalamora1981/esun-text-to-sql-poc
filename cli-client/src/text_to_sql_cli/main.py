import sys
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.text import Text

from .client import BackendClient

console = Console()

HELP_TEXT = """
[bold cyan]Matrix VC 数据分析助手[/bold cyan]

[bold]命令：[/bold]
  [green]/help[/green]    - 显示此帮助信息
  [green]/quit[/green]    - 退出程序
  [green]/exit[/green]    - 退出程序
  [green]/clear[/green]   - 清空对话历史（新建会话）
  [green]/tables[/green]  - 查看所有表名及说明
  [green]/schema[/green]  - 查看完整数据库结构

[bold]使用方式：[/bold]
  直接输入自然语言问题，例如：
  - "星辰成长基金的规模是多少"
  - "哪些企业在人工智能行业"
  - "各基金的 AUM 排名"
"""


def show_help():
    console.print(Panel(HELP_TEXT, title="帮助", border_style="cyan"))


def show_tables(client: BackendClient):
    try:
        tables = client.list_tables()
        table = Table(
            title="可用的数据库表", show_header=True, header_style="bold cyan"
        )
        table.add_column("表名", style="green")
        table.add_column("说明")
        for t in tables:
            table.add_row(t["name"], t["description"])
        console.print(table)
    except Exception as e:
        console.print(f"[red]获取表信息失败：{e}[/red]")


def show_schema(client: BackendClient):
    try:
        schema = client.get_schema()
        if schema:
            console.print(Panel(schema, title="数据库结构 (DDL)", border_style="cyan"))
        else:
            console.print("[red]数据库未初始化或没有表。[/red]")
    except Exception as e:
        console.print(f"[red]获取 schema 失败：{e}[/red]")


def _print_debug(event: dict):
    t = event.get("type", "")
    if t == "ai_tool_call":
        tool_name = event.get("tool_name", "")
        args = event.get("args", {})
        console.print(f"  [bold yellow][THINK] 调用工具: {tool_name}[/bold yellow]")
        if "query" in args:
            console.print(
                Panel(
                    args["query"],
                    title="[bold yellow]SQL 查询[/bold yellow]",
                    border_style="yellow",
                    width=100,
                )
            )
    elif t == "ai_thinking":
        content = event.get("content", "")
        if content:
            console.print(Text(f"  [dim]  {content}[/dim]"))
    elif t == "tool_result":
        content = event.get("content", "")
        tool_name = event.get("tool_name", "")
        label = f"[bold blue]工具返回"
        if tool_name:
            label += f" ({tool_name})"
        label += "[/bold blue]"
        console.print(Panel(content, title=label, border_style="blue", width=100))
    elif t == "error":
        console.print(f"  [red]错误: {event.get('content', '')}[/red]")
    elif t == "human":
        console.print(Text(f"  [USER] {event.get('content', '')}", style="dim bold"))


def _process_query_debug(client: BackendClient, user_input: str, session_id: str):
    console.print()
    console.print("[bold dim]--- Agent 执行过程 ---[/bold dim]")
    final_response = None
    try:
        for event in client.query_stream(user_input, session_id):
            if event.get("type") == "done":
                break
            if event.get("type") == "ai_response":
                final_response = event.get("content", "")
            else:
                _print_debug(event)
    except Exception as e:
        console.print(f"[red]请求失败：{e}[/red]")
        return

    console.print("[bold dim]--- 执行结束 ---[/bold dim]\n")
    if final_response:
        console.print(
            Panel(
                Markdown(final_response),
                title="[bold cyan]助手[/bold cyan]",
                border_style="cyan",
            )
        )


def _process_query_normal(client: BackendClient, user_input: str, session_id: str):
    with console.status("[bold cyan]思考中...[/bold cyan]"):
        try:
            result = client.query(user_input, session_id)
        except Exception as e:
            console.print(f"[red]请求失败：{e}[/red]")
            return

    console.print(
        Panel(
            Markdown(result["response"]),
            title="[bold cyan]助手[/bold cyan]",
            border_style="cyan",
        )
    )


def main(debug: bool = False):
    if not debug:
        debug = "--debug" in sys.argv

    if debug:
        console.print("[bold yellow]DEBUG 模式已开启[/bold yellow]\n")

    console.print(
        Panel(
            "[bold cyan]Matrix VC 数据分析助手[/bold cyan]\n"
            "输入自然语言问题查询基金、企业、投资等数据。\n"
            "输入 /help 查看帮助信息。",
            title="欢迎使用",
            border_style="cyan",
        )
    )

    try:
        client = BackendClient()
        console.print("[dim]正在连接后端服务...[/dim]")
        client.health()
        console.print("[green]后端服务已连接。[/green]\n")
    except Exception as e:
        console.print(f"[red]无法连接后端服务：{e}[/red]")
        console.print("[yellow]请确认后端服务已启动（text-to-sql-server）。[/yellow]")
        return

    try:
        session_id = client.create_session()
    except Exception as e:
        console.print(f"[red]创建会话失败：{e}[/red]")
        client.close()
        return

    while True:
        try:
            user_input = console.input("\n[bold green]你：[/bold green]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]再见！[/dim]")
            break

        if not user_input:
            continue

        if user_input in ("/quit", "/exit"):
            console.print("[dim]再见！[/dim]")
            break

        if user_input == "/help":
            show_help()
            continue

        if user_input == "/clear":
            try:
                client.delete_session(session_id)
                session_id = client.create_session()
                console.print("[dim]对话历史已清空。[/dim]")
            except Exception as e:
                console.print(f"[red]清空会话失败：{e}[/red]")
            continue

        if user_input == "/tables":
            show_tables(client)
            continue

        if user_input == "/schema":
            show_schema(client)
            continue

        if debug:
            _process_query_debug(client, user_input, session_id)
        else:
            _process_query_normal(client, user_input, session_id)

    client.close()


if __name__ == "__main__":
    main()
