import json
import uuid

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, SecretStr
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage as LCHumanMessage

from langchain.messages import HumanMessage, AIMessage, ToolMessage

from .agent import build_agent
from .db import get_all_ddl, TABLE_DESCRIPTIONS
from .config import load_settings
from .auth import get_current_user, login_user, logout_user
from .session_meta import (
    create_session as meta_create_session,
    list_sessions,
    get_session,
    update_session_title,
    delete_session_meta,
    save_message,
    get_messages,
    init_meta_db,
)

app = FastAPI(title="Matrix VC Text-to-SQL Backend API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_agent = None


@app.on_event("startup")
def startup():
    init_meta_db()


def _get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


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


def _get_final_response(result: dict) -> str | None:
    messages = result.get("messages", [])
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and not msg.tool_calls:
            return _extract_content(msg)
    return None


class QueryRequest(BaseModel):
    message: str
    session_id: str


class QueryResponse(BaseModel):
    response: str
    session_id: str


@app.post("/api/query", response_model=QueryResponse)
async def query(req: QueryRequest, user: dict = Depends(get_current_user)):
    try:
        agent = _get_agent()
        result = agent.invoke(
            {"messages": [HumanMessage(content=req.message)]},
            config={"configurable": {"thread_id": req.session_id}},
        )
        response = _get_final_response(result)
        if response is None:
            raise HTTPException(status_code=500, detail="No response generated")
        return QueryResponse(response=response, session_id=req.session_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {e}")


def _serialize_message(msg) -> dict | list[dict] | None:
    content = _extract_content(msg)
    if isinstance(msg, HumanMessage):
        return {"type": "human", "content": content}
    if isinstance(msg, AIMessage):
        if msg.tool_calls:
            parts = []
            for tc in msg.tool_calls:
                parts.append(
                    {
                        "type": "ai_tool_call",
                        "tool_name": tc.get("name", ""),
                        "args": tc.get("args", {}),
                    }
                )
            if content:
                parts.append({"type": "ai_thinking", "content": content})
            return parts
        return {"type": "ai_response", "content": content}
    if isinstance(msg, ToolMessage):
        tool_name = getattr(msg, "name", "") or ""
        return {"type": "tool_result", "content": content, "tool_name": tool_name}
    return None


@app.post("/api/query/stream")
async def query_stream(req: QueryRequest, user: dict = Depends(get_current_user)):
    import asyncio

    agent = _get_agent()

    def event_generator():
        try:
            for chunk in agent.stream(
                {"messages": [HumanMessage(content=req.message)]},
                config={"configurable": {"thread_id": req.session_id}},
                stream_mode="updates",
            ):
                for _node_name, node_update in chunk.items():
                    if not node_update:
                        continue
                    msgs = node_update.get("messages", [])
                    for msg in msgs:
                        result = _serialize_message(msg)
                        if not result:
                            continue
                        if isinstance(result, list):
                            for r in result:
                                yield f"data: {json.dumps(r, ensure_ascii=False)}\n\n"
                        else:
                            yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
        yield 'data: {"type": "done"}\n\n'

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest):
    return login_user(req.username, req.password)


@app.post("/api/auth/logout")
async def auth_logout(user: dict = Depends(get_current_user)):
    return logout_user(user.get("token", ""))


class SessionResponse(BaseModel):
    session_id: str
    title: str = ""
    created_at: str = ""
    updated_at: str = ""


@app.get("/api/sessions", response_model=list[SessionResponse])
async def get_sessions(user: dict = Depends(get_current_user)):
    return list_sessions(user["user_id"])


@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(user: dict = Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    result = meta_create_session(session_id, user["user_id"])
    return SessionResponse(**result)


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(get_current_user)):
    delete_session_meta(session_id, user["user_id"])
    return {"status": "ok"}


class UpdateTitleRequest(BaseModel):
    title: str


@app.patch("/api/sessions/{session_id}")
async def patch_session(
    session_id: str, req: UpdateTitleRequest, user: dict = Depends(get_current_user)
):
    existing = get_session(session_id, user["user_id"])
    if existing is None:
        raise HTTPException(status_code=404, detail="Session not found")
    update_session_title(session_id, user["user_id"], req.title)
    return {"status": "ok"}


class MessageSaveRequest(BaseModel):
    role: str
    content: str
    metadata: dict | None = None


@app.post("/api/sessions/{session_id}/messages")
async def post_messages(
    session_id: str, req: MessageSaveRequest, user: dict = Depends(get_current_user)
):
    existing = get_session(session_id, user["user_id"])
    if existing is None:
        raise HTTPException(status_code=404, detail="Session not found")
    save_message(session_id, req.role, req.content, req.metadata)
    return {"status": "ok"}


class MessageItem(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    metadata: dict | None = None
    created_at: str = ""


@app.get("/api/sessions/{session_id}/messages", response_model=list[MessageItem])
async def get_session_messages(session_id: str, user: dict = Depends(get_current_user)):
    existing = get_session(session_id, user["user_id"])
    if existing is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return get_messages(session_id)


class TableInfo(BaseModel):
    name: str
    description: str


@app.get("/api/tables", response_model=list[TableInfo])
async def list_tables():
    return [
        TableInfo(name=name, description=desc)
        for name, desc in TABLE_DESCRIPTIONS.items()
    ]


class SchemaResponse(BaseModel):
    ddl: str


@app.get("/api/schema", response_model=SchemaResponse)
async def get_schema():
    result = get_all_ddl()
    return SchemaResponse(ddl=result)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/sessions/{session_id}/summarize-title")
async def summarize_title(session_id: str, user: dict = Depends(get_current_user)):
    from .session_meta import get_messages

    existing = get_session(session_id, user["user_id"])
    if existing is None:
        raise HTTPException(status_code=404, detail="Session not found")

    msgs = get_messages(session_id)
    if not msgs:
        return {"title": "新对话"}

    conversation = ""
    for m in msgs[:6]:
        role = "用户" if m["role"] == "user" else "助手"
        content = m["content"][:200]
        conversation += f"{role}: {content}\n"

    settings = load_settings()
    llm = ChatOpenAI(
        base_url=settings.openai_base_url,
        api_key=SecretStr(settings.openai_api_key),
        model=settings.openai_model,
        temperature=0.0,
    )
    result = llm.invoke(
        [
            LCHumanMessage(
                content=(
                    "根据以下对话，生成一个简短的中文标题（不超过15个字），只输出标题文本，不要加引号或其他符号：\n\n"
                    + conversation
                )
            ),
        ]
    )
    content = result.content
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict):
                parts.append(p.get("text", str(p)))
            else:
                parts.append(str(p))
        title = "".join(parts).strip()
    else:
        title = content.strip()
    title = title.strip('"').strip("'").strip("「").strip("」")
    if len(title) > 30:
        title = title[:30] + "..."
    update_session_title(session_id, user["user_id"], title)
    return {"title": title}
