"""FastAPI REST API .

提供 OpenAI 兼容的 REST API 接口，允许外部服务通过 HTTP 调用 LLM。

Usage:
    uvicorn koduck.server:app --reload
    python -m koduck.server
"""

import json
import hashlib
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from koduck import __version__, create_client
from koduck.agent_roles import apply_role_messages, list_roles, resolve_role
from koduck.schema import FunctionCall, LLMProvider, Message, ToolCall
from koduck.quant_tools import (
    QUANT_TOOL_DEFS,
    execute_tool,
    list_discovered_skills,
    run_skill_command,
)
from koduck.tool_policy import append_tool_audit, can_execute_tool, read_tool_audits

logger = logging.getLogger(__name__)

# 
_clients: dict[str, Any] = {}
MAX_TOOL_CALL_ROUNDS = 4


def setup_logging() -> None:
    """Configure logging in the same style as koduck-data-service."""
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "json").lower()
    log_level = getattr(logging, log_level_name, logging.INFO)

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
            if log_format == "json"
            else structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Keep output format consistent by disabling uvicorn's plain access logs.
    uvicorn_access_logger = logging.getLogger("uvicorn.access")
    uvicorn_access_logger.handlers.clear()
    uvicorn_access_logger.propagate = False

    # Third-party noise control, aligned with current service behavior.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_api_key_for_provider(provider: str) -> str:
    """ provider  API .
    
    支持的环境变量:
    - OPENAI_API_KEY
    - MINIMAX_API_KEY
    - DEEPSEEK_API_KEY
    
    如果找不到特定密钥，回退到通用 LLM_API_KEY
    """
    provider_lower = provider.lower()
    
    if provider_lower == "openai":
        #  GPT_API_KEY
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GPT_API_KEY") or ""
    elif provider_lower == "minimax":
        api_key = os.getenv("MINIMAX_API_KEY") or ""
    elif provider_lower == "deepseek":
        api_key = os.getenv("DEEPSEEK_API_KEY") or ""
    else:
        api_key = ""
    
    # 
    if not api_key:
        api_key = os.getenv("LLM_API_KEY", "")
    
    return api_key


def get_api_base_for_provider(provider: str) -> str:
    """ provider  API Base URL.
    
    支持的环境变量:
    - OPENAI_API_BASE 或 LLM_API_BASE
    - MINIMAX_API_BASE 或 LLM_API_BASE
    - DEEPSEEK_API_BASE 或 LLM_API_BASE
    """
    provider_lower = provider.lower()
    
    if provider_lower == "openai":
        #  OpenAI ，
        return os.getenv("OPENAI_API_BASE") or os.getenv("LLM_API_BASE") or ""
    elif provider_lower == "minimax":
        #  MiniMax ，
        return os.getenv("MINIMAX_API_BASE") or os.getenv("LLM_API_BASE") or ""
    elif provider_lower == "deepseek":
        #  DeepSeek ，
        return os.getenv("DEEPSEEK_API_BASE") or os.getenv("LLM_API_BASE") or ""
    else:
        return os.getenv("LLM_API_BASE") or ""


def _build_client_cache_key(provider: str, api_key: str, api_base: str) -> str:
    digest = hashlib.sha256(f"{provider}|{api_key}|{api_base}".encode("utf-8")).hexdigest()[:16]
    return f"{provider}:{digest}"


def get_client(provider: str, api_key_override: str | None = None, api_base_override: str | None = None) -> Any:
    """."""
    if api_key_override is None:
        resolved_api_key = get_api_key_for_provider(provider)
    else:
        # （）
        resolved_api_key = (api_key_override or "").strip()
    resolved_api_base = (api_base_override or "").strip() or get_api_base_for_provider(provider)
    cache_key = _build_client_cache_key(provider, resolved_api_key, resolved_api_base)

    logger.info(f"[get_client] : provider={provider}, cached={cache_key in _clients}")
    if cache_key not in _clients:
        logger.info(f"[get_client] : provider={provider}")
        api_key = resolved_api_key
        if not api_key:
            logger.error(f"[get_client] API : provider={provider}")
            raise HTTPException(
                status_code=400, 
                detail=f"未找到 {provider} 的 API 密钥，请设置 {provider.upper()}_API_KEY 或 LLM_API_KEY 环境变量"
            )
        api_key_preview = api_key[:8] + "..." if len(api_key) > 8 else "***"
        logger.info(f"[get_client] API : provider={provider}, key_preview={api_key_preview}")
        
        api_base = resolved_api_base
        logger.info(f"[get_client] API Base: provider={provider}, api_base={api_base}")
        
        try:
            _clients[cache_key] = create_client(api_key=api_key, provider=provider, api_base=api_base)
            logger.info(f"[get_client] : provider={provider}")
        except ValueError as e:
            logger.error(f"[get_client] : provider={provider}, error={e}")
            raise HTTPException(status_code=400, detail=str(e))
    return _clients[cache_key]


# API 
class ChatMessage(BaseModel):
    """."""
    role: str = Field(..., description="消息角色: system/user/assistant/tool")
    content: str | None = Field(None, description="消息内容")
    thinking: str | None = Field(None, description="思考内容（仅 assistant）")
    tool_call_id: str | None = Field(None, description="工具调用 ID（仅 tool）")


class ChatCompletionRequest(BaseModel):
    """."""
    model: str | None = Field(None, description="模型名称")
    messages: list[ChatMessage] = Field(..., description="消息列表")
    provider: str = Field("minimax", description="LLM 提供商: minimax/deepseek/openai")
    apiKey: str | None = Field(None, description="可选：覆盖环境变量的 API Key")
    apiBase: str | None = Field(None, description="可选：覆盖环境变量的 API Base URL")
    role: str | None = Field(None, description="可选：会话角色，如 general/architect/coder/reviewer/analyst")
    temperature: float | None = Field(None, description="采样温度")
    max_tokens: int | None = Field(None, description="最大生成 token 数")
    stream: bool = Field(False, description="是否流式输出（暂不支持）")
    runtime: dict[str, Any] | None = Field(
        None,
        description="运行时选项，例如 {'enableTools': true, 'emitEvents': true, 'runId': '...'}",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "minimax",
                "messages": [
                    {"role": "user", "content": "你好，请介绍一下你自己"}
                ]
            }
        }


class ChatCompletionResponse(BaseModel):
    """."""
    id: str = Field(default="chatcmpl-koduck", description="响应 ID")
    object: str = Field(default="chat.completion", description="对象类型")
    created: int = Field(default=0, description="创建时间戳")
    model: str = Field(..., description="使用的模型")
    provider: str = Field(..., description="使用的提供商")
    choices: list[dict] = Field(..., description="响应选项")
    usage: dict | None = Field(None, description="Token 使用情况")
    run: dict[str, Any] | None = Field(None, description="运行元数据与事件轨迹")


class HealthResponse(BaseModel):
    """."""
    status: str = Field(default="ok", description="服务状态")
    version: str = Field(..., description="服务版本")


class ModelsResponse(BaseModel):
    """."""
    models: list[dict] = Field(..., description="可用模型列表")


class SimpleChatRequest(BaseModel):
    """（）."""
    messages: list[ChatMessage] = Field(..., description="消息列表")
    provider: str = Field("minimax", description="LLM 提供商")
    apiKey: str | None = Field(None, description="可选：覆盖环境变量的 API Key")
    apiBase: str | None = Field(None, description="可选：覆盖环境变量的 API Base URL")
    role: str | None = Field(None, description="可选：会话角色，如 general/architect/coder/reviewer/analyst")
    runtime: dict[str, Any] | None = Field(
        None,
        description="运行时选项，例如 {'enableTools': true, 'emitEvents': true, 'runId': '...'}",
    )


class SimpleChatData(BaseModel):
    """."""
    content: str = Field(..., description="回复内容")
    provider: str = Field(..., description="使用的提供商")
    model: str = Field(..., description="使用的模型")


class ApiResponseWrapper(BaseModel):
    """."""
    code: int = Field(0, description="响应码，0 表示成功")
    message: str = Field("success", description="响应消息")
    data: SimpleChatData = Field(..., description="响应数据")


class SkillRunRequest(BaseModel):
    """Manual skill run request."""

    skill: str = Field(..., description="Skill name, e.g. demo_skill")
    command: str = Field(..., description="Skill command")
    args: dict[str, Any] | None = Field(None, description="Optional command args")


def _to_internal_messages(messages: list[ChatMessage]) -> list[Message]:
    return [
        Message(
            role=msg.role,
            content=msg.content,
            thinking=msg.thinking,
            tool_call_id=msg.tool_call_id,
        )
        for msg in messages
    ]


def _to_openai_tool_calls(tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
    return [
        {
            "id": tc.id,
            "type": tc.type,
            "function": {
                "name": tc.function.name,
                "arguments": tc.function.arguments,
            },
        }
        for tc in tool_calls
    ]


def _ensure_tool_call_id(tool_call: ToolCall) -> ToolCall:
    if tool_call.id:
        return tool_call
    return ToolCall(
        id=f"call_{uuid.uuid4().hex[:12]}",
        type=tool_call.type or "function",
        function=FunctionCall(
            name=tool_call.function.name,
            arguments=tool_call.function.arguments,
        ),
    )


def _resolve_runtime(runtime: dict[str, Any] | None) -> dict[str, Any]:
    runtime = runtime or {}
    sub_agents_raw = runtime.get("subAgents")
    sub_agents: list[dict[str, str]] = []
    if isinstance(sub_agents_raw, list):
        for item in sub_agents_raw:
            if not isinstance(item, dict):
                continue
            role = resolve_role({"role": item.get("role")})
            name = str(item.get("name") or role)
            sub_agents.append({"name": name, "role": role})
    return {
        "run_id": str(runtime.get("runId") or f"run_{uuid.uuid4().hex[:12]}"),
        "enable_tools": bool(runtime.get("enableTools", True)),
        "emit_events": bool(runtime.get("emitEvents", True)),
        "role": resolve_role(runtime),
        "sub_agents": sub_agents[:8],
        "merge_strategy": str(runtime.get("mergeStrategy") or "lead-agent-summary"),
    }


def _new_event(run_id: str, event_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "run_id": run_id,
        "type": event_type,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": payload or {},
    }


async def _run_sub_agents(
    *,
    client: Any,
    parent_run_id: str,
    base_messages: list[Message],
    sub_agents: list[dict[str, str]],
) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    """Run sub-agents sequentially and return their outputs plus events."""
    outputs: list[dict[str, str]] = []
    events: list[dict[str, Any]] = []
    for idx, sub in enumerate(sub_agents, start=1):
        sub_run_id = f"{parent_run_id}_sub{idx}"
        events.append(
            _new_event(
                parent_run_id,
                "agent.spawned",
                {"sub_run_id": sub_run_id, "name": sub["name"], "role": sub["role"]},
            )
        )

        sub_runtime = {
            "runId": sub_run_id,
            "role": sub["role"],
            "enableTools": True,
            "emitEvents": False,
            "subAgents": [],
        }
        sub_response, _, _ = await _run_chat_with_tool_loop(
            client=client,
            messages=base_messages,
            runtime_options=sub_runtime,
        )
        outputs.append(
            {
                "sub_run_id": sub_run_id,
                "name": sub["name"],
                "role": sub["role"],
                "content": sub_response.content or "",
            }
        )
        events.append(
            _new_event(
                parent_run_id,
                "agent.completed",
                {"sub_run_id": sub_run_id, "name": sub["name"], "role": sub["role"]},
            )
        )
    return outputs, events


def _merge_sub_agent_outputs(outputs: list[dict[str, str]]) -> str:
    if not outputs:
        return ""
    lines = ["以下是子 Agent 观点，请综合后再回答用户："]
    for item in outputs:
        lines.append(f"- [{item['name']}/{item['role']}] {item['content']}")
    return "\n".join(lines)


async def _run_chat_with_tool_loop(
    client: Any,
    messages: list[Message],
    runtime_options: dict[str, Any] | None = None,
) -> tuple[Any, list[dict[str, Any]], str]:
    """Execute tool-calling loop and return final assistant response."""
    history = list(messages)
    runtime = _resolve_runtime(runtime_options)
    history = apply_role_messages(history, runtime["role"])
    run_id = runtime["run_id"]
    events: list[dict[str, Any]] = []
    events.append(
        _new_event(
            run_id,
            "run.started",
            {"state": "THINKING", "message_count": len(history)},
        )
    )
    if runtime["sub_agents"]:
        sub_outputs, sub_events = await _run_sub_agents(
            client=client,
            parent_run_id=run_id,
            base_messages=history,
            sub_agents=runtime["sub_agents"],
        )
        events.extend(sub_events)
        merged_sub_context = _merge_sub_agent_outputs(sub_outputs)
        if merged_sub_context:
            history.insert(0, Message(role="system", content=merged_sub_context))
            events.append(
                _new_event(
                    run_id,
                    "agent.merge.completed",
                    {
                        "strategy": runtime["merge_strategy"],
                        "sub_agent_count": len(sub_outputs),
                    },
                )
            )
    tool_round = 0
    tools = QUANT_TOOL_DEFS if runtime["enable_tools"] else None
    final_response = await client.generate(history, tools=tools)

    while runtime["enable_tools"] and final_response.tool_calls and tool_round < MAX_TOOL_CALL_ROUNDS:
        tool_round += 1
        tool_calls = [_ensure_tool_call_id(tc) for tc in final_response.tool_calls]
        history.append(
            Message(
                role="assistant",
                content=final_response.content or "",
                thinking=final_response.thinking,
                tool_calls=tool_calls,
            )
        )

        for tc in tool_calls:
            allowed, reason = can_execute_tool(tc.function.name, runtime_options)
            if not allowed:
                events.append(
                    _new_event(
                        run_id,
                        "tool.blocked",
                        {
                            "tool_name": tc.function.name,
                            "tool_call_id": tc.id,
                            "round": tool_round,
                            "reason": reason,
                        },
                    )
                )
                append_tool_audit(
                    run_id=run_id,
                    tool_name=tc.function.name,
                    tool_call_id=tc.id,
                    allowed=False,
                    reason=reason,
                    elapsed_ms=None,
                )
                history.append(
                    Message(
                        role="tool",
                        tool_call_id=tc.id,
                        content=json.dumps(
                            {"ok": False, "error": f"Tool call blocked by policy: {reason}"},
                            ensure_ascii=False,
                        ),
                    )
                )
                continue
            events.append(
                _new_event(
                    run_id,
                    "tool.requested",
                    {"tool_name": tc.function.name, "tool_call_id": tc.id, "round": tool_round},
                )
            )
            started_at = time.perf_counter()
            tool_content = await execute_tool(tc.function.name, tc.function.arguments)
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            history.append(
                Message(
                    role="tool",
                    tool_call_id=tc.id,
                    content=tool_content,
                )
            )
            events.append(
                _new_event(
                    run_id,
                    "tool.completed",
                    {
                        "tool_name": tc.function.name,
                        "tool_call_id": tc.id,
                        "round": tool_round,
                        "elapsed_ms": elapsed_ms,
                    },
                )
            )
            append_tool_audit(
                run_id=run_id,
                tool_name=tc.function.name,
                tool_call_id=tc.id,
                allowed=True,
                reason="allowed",
                elapsed_ms=elapsed_ms,
            )
            logger.info(
                "[ToolLoop] Executed tool: name=%s id=%s",
                tc.function.name,
                tc.id,
            )

        final_response = await client.generate(history, tools=tools)

    if final_response.tool_calls:
        logger.warning(
            "[ToolLoop] Reached max rounds with remaining tool_calls: rounds=%s",
            tool_round,
        )
        events.append(
            _new_event(
                run_id,
                "run.max_tool_rounds_reached",
                {"max_rounds": MAX_TOOL_CALL_ROUNDS},
            )
        )
    events.append(
        _new_event(
            run_id,
            "run.completed",
            {"state": "FINAL", "finish_reason": final_response.finish_reason},
        )
    )
    return final_response, events, run_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    """."""
    # 
    setup_logging()
    service_logger = structlog.get_logger()
    service_logger.info(
        "Starting Koduck API Server",
        version=__version__,
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        log_format=os.getenv("LOG_FORMAT", "json").lower(),
    )
    yield
    # 
    service_logger.info("Shutting down Koduck API Server")


#  FastAPI 
app = FastAPI(
    title="Koduck API",
    description="多平台 LLM 统一调用接口 - OpenAI 兼容 API",
    version=__version__,
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """."""
    return HealthResponse(version=__version__)


@app.get("/v1/models", response_model=ModelsResponse, tags=["Chat"])
async def list_models():
    """."""
    models = []
    for provider in LLMProvider:
        if provider == LLMProvider.MINIMAX:
            models.extend([
                {"id": "MiniMax-M2.5", "provider": "minimax", "name": "MiniMax M2.5"},
                {"id": "MiniMax-Text-01", "provider": "minimax", "name": "MiniMax Text-01"},
                {"id": "MiniMax-M1", "provider": "minimax", "name": "MiniMax M1"},
                {"id": "abab6.5s-chat", "provider": "minimax", "name": "abab6.5s"},
            ])
        elif provider == LLMProvider.OPENAI:
            models.extend([
                {"id": "gpt-4o-mini", "provider": "openai", "name": "GPT-4o mini"},
                {"id": "gpt-4o", "provider": "openai", "name": "GPT-4o"},
            ])
        elif provider == LLMProvider.DEEPSEEK:
            models.extend([
                {"id": "deepseek-chat", "provider": "deepseek", "name": "DeepSeek Chat"},
                {"id": "deepseek-reasoner", "provider": "deepseek", "name": "DeepSeek Reasoner"},
            ])
    return ModelsResponse(models=models)


@app.get("/api/v1/tools/audits", tags=["Tools"])
async def list_tool_audits(limit: int = 100):
    """Return recent tool audit records."""
    return {"data": read_tool_audits(limit=limit)}


@app.get("/api/v1/agent/roles", tags=["Agent"])
async def get_agent_roles():
    """Return built-in role profiles for runtime role switching."""
    return {"data": list_roles()}


@app.get("/api/v1/skills", tags=["Skills"])
async def get_skills():
    """List discovered skills."""
    return {"data": list_discovered_skills()}


@app.post("/api/v1/skills/run", tags=["Skills"])
async def run_skill(request: SkillRunRequest):
    """Run one discovered skill command manually."""
    result = await run_skill_command(
        skill_name=request.skill,
        command=request.command,
        args=request.args or {},
    )
    return {"data": json.loads(result)}


@app.post("/v1/chat/completions", response_model=ChatCompletionResponse, tags=["Chat"])
async def chat_completions(request: ChatCompletionRequest):
    """（OpenAI ）.
    
    支持的提供商:
    - minimax: MiniMax (默认)
    - deepseek: DeepSeek
    - openai: OpenAI
    
    示例请求:
    ```json
    {
        "provider": "minimax",
        "messages": [
            {"role": "user", "content": "你好"}
        ]
    }
    ```
    """
    # 
    logger.info(f"[ChatCompletions] : provider={request.provider}, model={request.model}, stream={request.stream}")
    logger.debug(f"[ChatCompletions] : {len(request.messages)}")
    for i, msg in enumerate(request.messages):
        content_preview = msg.content[:100] + "..." if msg.content and len(msg.content) > 100 else msg.content
        logger.debug(f"[ChatCompletions] Message[{i}]: role={msg.role}, content={content_preview}")

    if request.stream:
        logger.warning(f"[ChatCompletions] : ")
        raise HTTPException(
            status_code=501,
            detail="流式输出暂不支持，请设置 stream=false"
        )

    # 
    logger.debug(f"[ChatCompletions] : provider={request.provider}")
    client = get_client(request.provider, request.apiKey, request.apiBase)

    messages = _to_internal_messages(request.messages)

    try:
        logger.info(
            f"[ChatCompletions] 开始调用 LLM+ToolLoop: provider={request.provider}, model={client.model}"
        )
        runtime_options = dict(request.runtime or {})
        if request.role:
            runtime_options["role"] = request.role
        response, events, run_id = await _run_chat_with_tool_loop(
            client,
            messages,
            runtime_options,
        )
        logger.info(f"[ChatCompletions] LLM : finish_reason={response.finish_reason}")
        logger.debug(f"[ChatCompletions] LLM : {response.content[:200]}..." if response.content and len(response.content) > 200 else f"[ChatCompletions] LLM : {response.content}")

        # 
        choice = {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": response.content,
            },
            "finish_reason": response.finish_reason,
        }

        # （）
        if response.thinking:
            choice["message"]["thinking"] = response.thinking

        # （）
        if response.tool_calls:
            choice["message"]["tool_calls"] = _to_openai_tool_calls(response.tool_calls)

        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }

        result = ChatCompletionResponse(
            model=client.model,
            provider=request.provider,
            choices=[choice],
            usage=usage,
            run={
                "id": run_id,
                "events": events if _resolve_runtime(runtime_options)["emit_events"] else [],
                "enable_tools": _resolve_runtime(runtime_options)["enable_tools"],
                "role": _resolve_runtime(runtime_options)["role"],
                "sub_agent_count": len(_resolve_runtime(runtime_options)["sub_agents"]),
                "merge_strategy": _resolve_runtime(runtime_options)["merge_strategy"],
            },
        )
        logger.info(f"[ChatCompletions] : model={result.model}, provider={result.provider}")
        return result

    except HTTPException as he:
        #  HTTPException
        logger.warning(f"[ChatCompletions] HTTPException: status={he.status_code}, detail={he.detail}")
        raise
    except Exception as e:
        error_msg = str(e).lower()
        error_type = type(e).__name__
        logger.error(f"[ChatCompletions] : type={error_type}, provider={request.provider}, error={e}")
        logger.error(f"[ChatCompletions] : {repr(e)}")
        
        # 
        if "api key" in error_msg or "authentication" in error_msg or "unauthorized" in error_msg:
            logger.error(f"[ChatCompletions] API ")
            raise HTTPException(
                status_code=401, 
                detail=f"{request.provider} API 密钥无效或缺失，请检查环境变量配置"
            )
        elif "rate limit" in error_msg or "too many requests" in error_msg:
            logger.error(f"[ChatCompletions] ")
            raise HTTPException(
                status_code=429, 
                detail=f"{request.provider} API 请求过于频繁，请稍后重试"
            )
        elif "timeout" in error_msg:
            logger.error(f"[ChatCompletions] ")
            raise HTTPException(
                status_code=504, 
                detail=f"{request.provider} API 响应超时"
            )
        elif "connection" in error_msg or "network" in error_msg:
            logger.error(f"[ChatCompletions] ")
            raise HTTPException(
                status_code=503, 
                detail=f"无法连接到 {request.provider} API 服务"
            )
        else:
            logger.error(f"[ChatCompletions] ")
            raise HTTPException(
                status_code=500, 
                detail=f"{request.provider} AI 服务错误: {str(e)}"
            )


@app.post("/api/v1/ai/chat", response_model=ApiResponseWrapper, tags=["Chat"])
async def simple_chat(request: SimpleChatRequest):
    """（）.
    
    这是前端 AIChat 组件直接调用的接口，格式更简洁。
    
    示例请求:
    ```json
    {
        "provider": "minimax",
        "messages": [
            {"role": "system", "content": "你是一位AI助手..."},
            {"role": "user", "content": "你好"}
        ]
    }
    ```
    
    响应格式:
    ```json
    {
        "code": 0,
        "message": "success",
        "data": {
            "content": "回复内容",
            "provider": "minimax",
            "model": "MiniMax-M2.5"
        }
    }
    ```
    """
    # 
    logger.info(f"[SimpleChat] : provider={request.provider}")
    logger.info(f"[SimpleChat] : {len(request.messages)}")
    for i, msg in enumerate(request.messages):
        content_preview = msg.content[:100] + "..." if msg.content and len(msg.content) > 100 else msg.content
        logger.info(f"[SimpleChat] Message[{i}]: role={msg.role}, content={content_preview}")

    # 
    logger.info(f"[SimpleChat] : provider={request.provider}")
    client = get_client(request.provider, request.apiKey, request.apiBase)

    messages = _to_internal_messages(request.messages)

    try:
        logger.info(
            f"[SimpleChat] 开始调用 LLM+ToolLoop: provider={request.provider}, model={client.model}"
        )
        runtime_options = dict(request.runtime or {})
        if request.role:
            runtime_options["role"] = request.role
        response, _, _ = await _run_chat_with_tool_loop(
            client,
            messages,
            runtime_options,
        )
        logger.info(f"[SimpleChat] LLM : finish_reason={response.finish_reason}")
        
        content_preview = response.content[:200] + "..." if response.content and len(response.content) > 200 else response.content
        logger.info(f"[SimpleChat] LLM : {content_preview}")

        # 
        result = ApiResponseWrapper(
            code=0,
            message="success",
            data=SimpleChatData(
                content=response.content or "",
                provider=request.provider,
                model=client.model,
            )
        )
        logger.info(f"[SimpleChat] : code={result.code}, model={result.data.model}")
        return result

    except HTTPException as he:
        logger.warning(f"[SimpleChat] HTTPException: status={he.status_code}, detail={he.detail}")
        raise
    except Exception as e:
        error_msg = str(e).lower()
        error_type = type(e).__name__
        logger.error(f"[SimpleChat] : type={error_type}, provider={request.provider}, error={e}")
        logger.error(f"[SimpleChat] : {repr(e)}")
        
        if "api key" in error_msg or "authentication" in error_msg or "unauthorized" in error_msg:
            raise HTTPException(
                status_code=401, 
                detail=f"{request.provider} API 密钥无效或缺失，请检查环境变量配置"
            )
        elif "rate limit" in error_msg or "too many requests" in error_msg:
            raise HTTPException(
                status_code=429, 
                detail=f"{request.provider} API 请求过于频繁，请稍后重试"
            )
        elif "timeout" in error_msg:
            raise HTTPException(
                status_code=504, 
                detail=f"{request.provider} API 响应超时"
            )
        elif "connection" in error_msg or "network" in error_msg:
            raise HTTPException(
                status_code=503, 
                detail=f"无法连接到 {request.provider} API 服务"
            )
        else:
            raise HTTPException(
                status_code=500, 
                detail=f"{request.provider} AI 服务错误: {str(e)}"
            )


@app.post("/api/v1/ai/chat/stream", tags=["Chat"])
async def simple_chat_stream(request: SimpleChatRequest):
    """（SSE）.
    
    返回 Server-Sent Events 格式，支持流式输出 AI 响应。
    
    示例请求:
    ```json
    {
        "provider": "minimax",
        "messages": [
            {"role": "system", "content": "你是一位AI助手..."},
            {"role": "user", "content": "你好"}
        ]
    }
    ```
    
    SSE 事件格式:
    - `event: delta` - 流式内容块
    - `event: done` - 完成
    - `event: error` - 错误
    """
    logger.info(f"[SimpleChatStream] : provider={request.provider}")
    
    async def event_generator():
        try:
            client = get_client(request.provider, request.apiKey, request.apiBase)
            
            messages = _to_internal_messages(request.messages)
            
            # 
            yield f"event: start\ndata: {json.dumps({'model': client.model, 'provider': request.provider})}\n\n"
            
            # ， SSE delta
            runtime_options = dict(request.runtime or {})
            if request.role:
                runtime_options["role"] = request.role
            response, events, run_id = await _run_chat_with_tool_loop(
                client,
                messages,
                runtime_options,
            )
            runtime = _resolve_runtime(runtime_options)
            if runtime["emit_events"]:
                for evt in events:
                    yield f"event: {evt['type']}\ndata: {json.dumps(evt, ensure_ascii=False)}\n\n"
            full_content = response.content or ""
            chunk_size = 24
            for i in range(0, len(full_content), chunk_size):
                delta = full_content[i:i + chunk_size]
                yield f"event: delta\ndata: {json.dumps({'content': delta})}\n\n"

            yield f"event: done\ndata: {json.dumps({'content': full_content, 'model': client.model, 'provider': request.provider, 'runId': run_id})}\n\n"
            
            logger.info(f"[SimpleChatStream] : content_length={len(full_content)}")
            
        except HTTPException as he:
            logger.error(f"[SimpleChatStream] HTTPException: {he.detail}")
            yield f"event: error\ndata: {json.dumps({'code': he.status_code, 'message': he.detail})}\n\n"
        except Exception as e:
            logger.error(f"[SimpleChatStream] : {type(e).__name__}: {e}")
            yield f"event: error\ndata: {json.dumps({'code': 500, 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  #  Nginx 
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP ."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "type": "api_error"}},
    )


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """ API ."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
