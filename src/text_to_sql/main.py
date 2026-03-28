import sys
import uuid
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.text import Text

from langchain.messages import HumanMessage, AIMessage, ToolMessage

from .agent import build_agent
from .db import get_all_ddl, TABLE_DESCRIPTIONS

console = Console()

HELP_TEXT = """
[bold cyan]Matrix VC 数据分析助手[/bold cyan]

[bold]命令：[/bold]
  [green]/help[/green]    - 显示此帮助信息
  [green]/quit[/green]    - 退出程序
  [green]/exit[/green]    - 退出程序
  [green]/clear[/green]   - 清空对话历史
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


def show_tables():
    table = Table(title="可用的数据库表", show_header=True, header_style="bold cyan")
    table.add_column("表名", style="green")
    table.add_column("说明")
    for name, desc in TABLE_DESCRIPTIONS.items():
        table.add_row(name, desc)
    console.print(table)


def show_schema():
    ddl = get_all_ddl()
    if ddl:
        console.print(Panel(ddl, title="数据库结构 (DDL)", border_style="cyan"))
    else:
        console.print("[red]数据库未初始化或没有表。[/red]")


def _extract_content(msg) -> str:
    c = msg.content
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for p in c:
            if isinstance(p, dict):
                parts.append(p.get("text", str(p)))
            else:
                parts.append(str(p))
        return "".join(parts)
    return str(c)


def _print_debug(target_console: Console, messages: list):
    for msg in messages:
        if isinstance(msg, HumanMessage):
            target_console.print(
                Text(f"  [USER] {_extract_content(msg)}", style="dim bold")
            )
        elif isinstance(msg, AIMessage):
            content = _extract_content(msg)
            if msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_name = tc.get("name", "?")
                    tool_args = tc.get("args", {})
                    target_console.print(f"  [THINK] 调用工具: {tool_name}")
                    if "query" in tool_args:
                        sql = tool_args["query"]
                        target_console.print(
                            Panel(
                                sql,
                                title="[bold yellow]SQL 查询[/bold yellow]",
                                border_style="yellow",
                                width=100,
                            )
                        )
            else:
                if content:
                    target_console.print(Text(f"  [THINK] {content}", style="dim"))
        elif isinstance(msg, ToolMessage):
            content = _extract_content(msg)
            tool_name = ""
            if hasattr(msg, "name") and msg.name:
                tool_name = f" ({msg.name})"
            target_console.print(
                Panel(
                    content,
                    title=f"[bold blue]工具返回{tool_name}[/bold blue]",
                    border_style="blue",
                    width=100,
                )
            )


def _get_final_response(result: dict):
    messages = result.get("messages", [])
    return _get_final_response_from_list(messages)


def _get_final_response_from_list(messages: list):
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and not msg.tool_calls:
            return msg
    return None


def _process_query(
    agent, user_input: str, thread_id: str, target_console: Console, debug: bool = False
):
    target_console.print()

    if debug:
        target_console.print("[bold dim]--- Agent 执行过程 ---[/bold dim]")
        try:
            all_msgs: list = []
            for chunk in agent.stream(
                {"messages": [HumanMessage(content=user_input)]},
                config={"configurable": {"thread_id": thread_id}},
                stream_mode="updates",
            ):
                for _node_name, node_update in chunk.items():
                    if not node_update:
                        continue
                    msgs = node_update.get("messages", [])
                    if msgs:
                        _print_debug(target_console, msgs)
                        all_msgs.extend(msgs)
        except Exception as e:
            target_console.print(f"[red]请求失败：{e}[/red]")
            target_console.print("[yellow]请检查网络和 LLM 服务配置。[/yellow]")
            return

        target_console.print("[bold dim]--- 执行结束 ---[/bold dim]\n")

        final_msg = _get_final_response_from_list(all_msgs)
        if final_msg:
            content = _extract_content(final_msg)
            target_console.print(
                Panel(
                    Markdown(content),
                    title="[bold cyan]助手[/bold cyan]",
                    border_style="cyan",
                )
            )
    else:
        with target_console.status("[bold cyan]思考中...[/bold cyan]"):
            try:
                result = agent.invoke(
                    {"messages": [HumanMessage(content=user_input)]},
                    config={"configurable": {"thread_id": thread_id}},
                )
            except Exception as e:
                target_console.print(f"[red]请求失败：{e}[/red]")
                target_console.print("[yellow]请检查网络和 LLM 服务配置。[/yellow]")
                return

        final_msg = _get_final_response(result)
        if final_msg:
            content = _extract_content(final_msg)
            target_console.print(
                Panel(
                    Markdown(content),
                    title="[bold cyan]助手[/bold cyan]",
                    border_style="cyan",
                )
            )


def _parse_debug() -> bool:
    return "--debug" in sys.argv


def main(debug: bool = False):
    if not debug:
        debug = _parse_debug()

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
        agent = build_agent()
    except Exception as e:
        console.print(f"[red]Agent 初始化失败：{e}[/red]")
        console.print("[yellow]请检查 .env 配置文件和 LLM 服务是否可用。[/yellow]")
        return

    thread_id = str(uuid.uuid4())

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
            thread_id = str(uuid.uuid4())
            console.print("[dim]对话历史已清空。[/dim]")
            continue

        if user_input == "/tables":
            show_tables()
            continue

        if user_input == "/schema":
            show_schema()
            continue

        _process_query(agent, user_input, thread_id, console, debug=debug)


if __name__ == "__main__":
    debug = "--debug" in sys.argv
    main(debug=debug)
