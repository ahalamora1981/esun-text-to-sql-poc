import json

from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from langchain.messages import HumanMessage, AIMessage, ToolMessage

from .agent import build_agent
from .db import get_all_ddl, TABLE_DESCRIPTIONS

app = FastAPI(title="Matrix VC Text-to-SQL Backend API", version="0.1.0")

_agent = None


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
async def query(req: QueryRequest):
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


def _serialize_message(msg) -> dict | None:
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
async def query_stream(req: QueryRequest):
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


class SessionResponse(BaseModel):
    session_id: str


@app.post("/api/sessions", response_model=SessionResponse)
async def create_session():
    import uuid

    return SessionResponse(session_id=str(uuid.uuid4()))


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    return {"status": "ok"}


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
