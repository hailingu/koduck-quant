"""FastAPI REST API .

提供 OpenAI 兼容的 REST API 接口，允许外部服务通过 HTTP 调用 LLM。

Usage:
    uvicorn koduck.server:app --reload
    python -m koduck.server
"""

import asyncio
import json
import hashlib
import logging
import os
import re
import sys
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from koduck import __version__, create_client
from koduck.schema import FunctionCall, LLMProvider, Message, ToolCall
from koduck.quant_tools import (
    QUANT_TOOL_DEFS,
    execute_tool,
    get_tool_definition,
)
from koduck.tool_policy import append_tool_audit, can_execute_tool

# Memory System Integration
try:
    from koduck.memory import (
        build_messages_with_memory,
        process_session_summary
    )
    MEMORY_SYSTEM_AVAILABLE = True
except ImportError:
    MEMORY_SYSTEM_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("[Memory] Memory system not available, skipping context injection")

logger = logging.getLogger(__name__)

# 
_clients: dict[str, Any] = {}
MAX_TOOL_CALL_ROUNDS = 4
TOOL_AWARE_SYSTEM_GUARD = (
    "工具调用约束:\n"
    "1) 你可以调用工具来获取外部信息，尤其是实时信息。\n"
    "2) 当用户询问财经新闻、市场快讯、财联社、第一财经等问题时，优先调用 search_finance_news 工具；"
    "当用户询问一般今日新闻、最新消息、实时事件时，优先调用 search_web_news 工具；"
    "不要直接回答“无法联网/无法获取实时信息”。\n"
    "3) 调用 search_finance_news 时，为了覆盖更全面的信息，你应该同时用中英文查询: "
    "用中文关键词(如\"工商银行\")查询中文媒体(cls/yicai)，"
    "用英文关键词(如\"ICBC Industrial Commercial Bank\")查询英文媒体(bloomberg/reuters等)。"
    "如果用户没有指定媒体来源，请同时查询中英文所有可用来源。\n"
    "4) 拿到工具结果后，先给出简要结论，再列出关键来源与发布时间；若工具失败，明确说明失败原因并给出可执行替代建议。"
)


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


def _build_client_cache_key(provider: str, api_key: str, api_base: str, model: str = "") -> str:
    digest = hashlib.sha256(f"{provider}|{api_key}|{api_base}|{model}".encode("utf-8")).hexdigest()[:16]
    return f"{provider}:{digest}"


def get_client(provider: str, api_key_override: str | None = None, api_base_override: str | None = None, model_override: str | None = None) -> Any:
    """."""
    if api_key_override is None:
        resolved_api_key = get_api_key_for_provider(provider)
    else:
        # （）
        resolved_api_key = (api_key_override or "").strip()
    resolved_api_base = (api_base_override or "").strip() or get_api_base_for_provider(provider)
    cache_key = _build_client_cache_key(provider, resolved_api_key, resolved_api_base, model_override or "")

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
            _clients[cache_key] = create_client(api_key=api_key, provider=provider, api_base=api_base, model=model_override or "")
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
    temperature: float | None = Field(None, description="采样温度")
    max_tokens: int | None = Field(None, description="最大生成 token 数")
    stream: bool = Field(False, description="是否流式输出（暂不支持）")
    runtimeOptions: dict[str, Any] | None = Field(
        None,
        description="可选：运行时工具/策略配置",
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
    session_id: str | None = Field(None, description="会话 ID")
    choices: list[dict] = Field(..., description="响应选项")
    usage: dict | None = Field(None, description="Token 使用情况")


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
    model: str | None = Field(None, description="可选：模型名称，默认使用提供商默认模型")
    sessionId: str | None = Field(None, description="可选：会话 ID（不传则自动生成）")
    apiKey: str | None = Field(None, description="可选：覆盖环境变量的 API Key")
    apiBase: str | None = Field(None, description="可选：覆盖环境变量的 API Base URL")
    runtimeOptions: dict[str, Any] | None = Field(
        None,
        description="可选：运行时工具/策略配置",
    )


class SimpleChatData(BaseModel):
    """."""
    content: str = Field(..., description="回复内容")
    provider: str = Field(..., description="使用的提供商")
    model: str = Field(..., description="使用的模型")
    sessionId: str = Field(..., description="会话 ID")


class ApiResponseWrapper(BaseModel):
    """."""
    code: int = Field(0, description="响应码，0 表示成功")
    message: str = Field("success", description="响应消息")
    data: SimpleChatData = Field(..., description="响应数据")


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


def _resolve_session_id(raw_session_id: str | None) -> str:
    value = (raw_session_id or "").strip()
    if value and re.fullmatch(r"[A-Za-z0-9_\-]{6,64}", value):
        return value
    return f"sess_{uuid.uuid4().hex[:16]}"


def _append_instruction_to_system(
    messages: list[Message],
    instruction: str,
) -> list[Message]:
    if not instruction.strip():
        return messages
    updated = list(messages)
    for i, msg in enumerate(updated):
        if msg.role.lower() == "system":
            merged = (msg.content or "").strip()
            merged_content = instruction if not merged else f"{merged}\n\n{instruction}"
            updated[i] = Message(
                role=msg.role,
                content=merged_content,
                thinking=msg.thinking,
                tool_call_id=msg.tool_call_id,
            )
            return updated
    updated.insert(0, Message(role="system", content=instruction))
    return updated


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


async def _run_chat_with_tool_loop(
    client: Any,
    messages: list[Message],
    runtime_options: dict[str, Any] | None = None,
) -> tuple[Any, list[dict[str, Any]], str]:
    """Execute tool-calling loop and return final assistant response."""
    runtime_options = runtime_options or {}
    run_id = str(runtime_options.get("runId") or f"run_{uuid.uuid4().hex[:12]}")
    tools_enabled = bool(runtime_options.get("enableTools", True))

    history = list(messages)
    tool_round = 0
    runtime_events: list[dict[str, Any]] = []
    runtime_events.append({"type": "run.started", "run_id": run_id})

    for idx, sub_agent in enumerate(runtime_options.get("subAgents", []) or []):
        if not isinstance(sub_agent, dict):
            continue
        agent_name = str(sub_agent.get("name") or f"subagent_{idx + 1}")
        agent_role = str(sub_agent.get("role") or "general")
        runtime_events.append(
            {
                "type": "agent.spawned",
                "run_id": run_id,
                "agent": agent_name,
                "role": agent_role,
            }
        )
        runtime_events.append(
            {
                "type": "agent.completed",
                "run_id": run_id,
                "agent": agent_name,
                "role": agent_role,
            }
        )

    if runtime_options.get("subAgents"):
        runtime_events.append(
            {
                "type": "agent.merge.completed",
                "run_id": run_id,
                "strategy": runtime_options.get("mergeStrategy", "lead-agent-summary"),
            }
        )

    active_tools = QUANT_TOOL_DEFS if tools_enabled else []
    final_response = await client.generate(history, tools=active_tools)

    while final_response.tool_calls and tool_round < MAX_TOOL_CALL_ROUNDS:
        if not tools_enabled:
            break
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
            tool_def = get_tool_definition(tc.function.name)
            tool_meta = (tool_def.metadata or {}) if tool_def is not None else {}
            tool_source = str(tool_meta.get("source") or "")
            tool_publisher = str(tool_meta.get("publisher") or "")
            tool_version = str(tool_meta.get("version") or "")
            tool_checksum = str(tool_meta.get("checksum") or "")
            allowed, reason = can_execute_tool(tc.function.name, runtime_options)
            runtime_events.append(
                {
                    "type": "tool.requested",
                    "run_id": run_id,
                    "tool_name": tc.function.name,
                    "tool_call_id": tc.id,
                    "arguments": tc.function.arguments,
                }
            )

            started_at = time.perf_counter()
            if not allowed:
                tool_content = json.dumps(
                    {
                        "ok": False,
                        "error": f"Tool policy denied: {reason}",
                        "tool": tc.function.name,
                    },
                    ensure_ascii=False,
                )
            else:
                tool_content = await execute_tool(tc.function.name, tc.function.arguments)

            elapsed_ms = int((time.perf_counter() - started_at) * 1000)

            append_tool_audit(
                run_id=run_id,
                tool_name=tc.function.name,
                tool_call_id=tc.id,
                allowed=allowed,
                reason=reason,
                elapsed_ms=elapsed_ms,
                source=tool_source,
                publisher=tool_publisher,
                version=tool_version,
                checksum=tool_checksum,
            )

            result_ok = False
            result_error = ""
            try:
                parsed_result = json.loads(tool_content)
                if isinstance(parsed_result, dict):
                    result_ok = bool(parsed_result.get("ok", False))
                    result_error = str(parsed_result.get("error", "") or "")
            except Exception:
                parsed_result = None

            completed_event = {
                "type": "tool.completed",
                "run_id": run_id,
                "round": tool_round,
                "tool_name": tc.function.name,
                "tool_call_id": tc.id,
                "arguments": tc.function.arguments,
                "ok": result_ok,
                "error": result_error,
                "result_preview": tool_content[:500],
                "elapsed_ms": elapsed_ms,
                "allowed": allowed,
                "policy_reason": reason,
                "source": tool_source,
                "publisher": tool_publisher,
                "version": tool_version,
                "checksum": tool_checksum,
            }
            runtime_events.append(completed_event)
            history.append(
                Message(
                    role="tool",
                    tool_call_id=tc.id,
                    content=tool_content,
                )
            )
            # Extract useful info from parsed result for logging
            result_query = ""
            result_sources: list[str] = []
            result_provider = ""
            result_count = 0
            if isinstance(parsed_result, dict):
                result_query = str(parsed_result.get("query", ""))[:50]
                result_provider = str(parsed_result.get("provider", ""))
                result_count = int(parsed_result.get("count", 0))
                raw_sources = parsed_result.get("sources")
                if isinstance(raw_sources, list):
                    result_sources = [str(s) for s in raw_sources]
            logger.info(
                "[ToolLoop] Executed tool: name=%s id=%s ok=%s allowed=%s query=%s sources=%s provider=%s count=%s error=%s",
                tc.function.name,
                tc.id,
                result_ok,
                allowed,
                result_query,
                ",".join(result_sources) if result_sources else "-",
                result_provider or "-",
                result_count,
                result_error[:100],
            )

        final_response = await client.generate(history, tools=active_tools)

    if final_response.tool_calls:
        logger.warning(
            "[ToolLoop] Reached max rounds with remaining tool_calls: rounds=%s",
            tool_round,
        )
    runtime_events.append(
        {
            "type": "run.completed",
            "run_id": run_id,
            "tool_rounds": tool_round,
            "finish_reason": final_response.finish_reason,
        }
    )
    return final_response, runtime_events, run_id


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
    
    # Initialize Memory System
    if MEMORY_SYSTEM_AVAILABLE:
        try:
            from koduck.memory.server_integration import init_memory_integration
            # Note: db_pool should be passed from app state or created here
            # For now, we'll initialize lazily in the first request
            service_logger.info("[Memory] Memory system available, will initialize on first use")
        except Exception as e:
            service_logger.warning(f"[Memory] Failed to import memory integration: {e}")
    
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
                {"id": "MiniMax-M2.7", "provider": "minimax", "name": "MiniMax M2.7"},
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
    session_id = _resolve_session_id(None)
    logger.info(
        f"[ChatCompletions] : provider={request.provider}, model={request.model}, stream={request.stream}, session_id={session_id}"
    )
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
    messages = _append_instruction_to_system(messages, TOOL_AWARE_SYSTEM_GUARD)

    try:
        logger.info(
            f"[ChatCompletions] 开始调用 LLM+ToolLoop: provider={request.provider}, model={client.model}, session_id={session_id}"
        )
        response, executed_tools, _ = await _run_chat_with_tool_loop(
            client,
            messages,
            request.runtimeOptions or {},
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
            session_id=session_id,
            choices=[choice],
            usage=usage,
        )
        tool_events = [evt for evt in executed_tools if evt.get("type") == "tool.completed"]
        if tool_events:
            logger.info(
                "[ChatCompletions] tool_calls: session_id=%s count=%s details=%s",
                session_id,
                len(tool_events),
                json.dumps(tool_events, ensure_ascii=False)[:1200],
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
            "model": "MiniMax-M2.7"
        }
    }
    ```
    """
    # 
    session_id = _resolve_session_id(request.sessionId)
    logger.info(f"[SimpleChat] : provider={request.provider}, session_id={session_id}")
    logger.info(f"[SimpleChat] : {len(request.messages)}")
    for i, msg in enumerate(request.messages):
        content_preview = msg.content[:100] + "..." if msg.content and len(msg.content) > 100 else msg.content
        logger.info(f"[SimpleChat] Message[{i}]: role={msg.role}, content={content_preview}")

    # 
    logger.info(f"[SimpleChat] : provider={request.provider}, session_id={session_id}")
    client = get_client(request.provider, request.apiKey, request.apiBase)

    messages = _to_internal_messages(request.messages)
    
    # ===== Memory System: Inject Context =====
    memory_options = (request.runtimeOptions or {}).get("memory", {})
    if MEMORY_SYSTEM_AVAILABLE and memory_options.get("retrieve_context", True):
        try:
            from koduck.memory import build_messages_with_memory
            # Get user_id from runtime options or default to 1
            user_id = int(memory_options.get("user_id", 1))
            
            # Lazy initialize db_pool if needed
            db_pool = await _get_db_pool()
            if db_pool:
                messages = await build_messages_with_memory(
                    user_id=user_id,
                    session_id=session_id,
                    messages=messages,
                    db_pool=db_pool,
                    memory_config=memory_options
                )
                logger.info(f"[Memory] Context injected for user {user_id}, session {session_id}")
        except Exception as e:
            logger.warning(f"[Memory] Failed to inject context: {e}")
    # ==========================================
    
    messages = _append_instruction_to_system(messages, TOOL_AWARE_SYSTEM_GUARD)

    try:
        logger.info(
            f"[SimpleChat] 开始调用 LLM+ToolLoop: provider={request.provider}, model={client.model}, session_id={session_id}"
        )
        response, executed_tools, _ = await _run_chat_with_tool_loop(
            client,
            messages,
            request.runtimeOptions or {},
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
                sessionId=session_id,
            )
        )
        tool_events = [evt for evt in executed_tools if evt.get("type") == "tool.completed"]
        if tool_events:
            logger.info(
                "[SimpleChat] tool_calls: session_id=%s count=%s details=%s",
                session_id,
                len(tool_events),
                json.dumps(tool_events, ensure_ascii=False)[:1200],
            )
        logger.info(f"[SimpleChat] : code={result.code}, model={result.data.model}")
        
        # ===== Memory System: Async Summary Generation =====
        if MEMORY_SYSTEM_AVAILABLE and memory_options.get("auto_summarize", True):
            try:
                asyncio.create_task(
                    _generate_summary_async(
                        user_id=int(memory_options.get("user_id", 1)),
                        session_id=session_id,
                        messages=request.messages + [
                            ChatMessage(role="assistant", content=response.content or "")
                        ]
                    )
                )
                logger.debug(f"[Memory] Triggered async summary generation for session {session_id}")
            except Exception as e:
                logger.warning(f"[Memory] Failed to trigger summary generation: {e}")
        # ==================================================
        
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
    session_id = _resolve_session_id(request.sessionId)
    logger.info(f"[SimpleChatStream] : provider={request.provider}, session_id={session_id}")
    
    async def event_generator():
        try:
            client = get_client(request.provider, request.apiKey, request.apiBase, request.model)
            
            messages = _to_internal_messages(request.messages)
            
            # ===== Memory System: Inject Context =====
            memory_options = (request.runtimeOptions or {}).get("memory", {})
            if MEMORY_SYSTEM_AVAILABLE and memory_options.get("retrieve_context", True):
                try:
                    from koduck.memory import build_messages_with_memory
                    user_id = int(memory_options.get("user_id", 1))
                    
                    db_pool = await _get_db_pool()
                    if db_pool:
                        messages = await build_messages_with_memory(
                            user_id=user_id,
                            session_id=session_id,
                            messages=messages,
                            db_pool=db_pool,
                            memory_config=memory_options
                        )
                        logger.info(f"[Memory] Context injected for user {user_id}, session {session_id}")
                except Exception as e:
                    logger.warning(f"[Memory] Failed to inject context: {e}")
            # ==========================================
            
            messages = _append_instruction_to_system(messages, TOOL_AWARE_SYSTEM_GUARD)
            
            # Send start event
            yield f"event: start\ndata: {json.dumps({'model': client.model, 'provider': request.provider, 'session_id': session_id})}\n\n"
            
            # Stream endpoint now also supports tools by using the same tool loop.
            response, runtime_events, _ = await _run_chat_with_tool_loop(
                client,
                messages,
                request.runtimeOptions or {},
            )
            for tool_event in runtime_events:
                if tool_event.get("type") != "tool.completed":
                    continue
                tool_payload = {
                    "session_id": session_id,
                    **tool_event,
                }
                yield f"event: tool\ndata: {json.dumps(tool_payload, ensure_ascii=False)}\n\n"
            full_content = response.content or ""
            chunk_size = 80
            for i in range(0, len(full_content), chunk_size):
                delta = full_content[i : i + chunk_size]
                yield f"event: delta\ndata: {json.dumps({'content': delta})}\n\n"

            # Prepare usage info for done event
            usage_dict = None
            if response.usage:
                usage_dict = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }
            yield f"event: done\ndata: {json.dumps({'content': full_content, 'model': client.model, 'provider': request.provider, 'session_id': session_id, 'usage': usage_dict})}\n\n"
            
            logger.info(
                f"[SimpleChatStream] : session_id={session_id}, content_length={len(full_content)}, tools={len([e for e in runtime_events if e.get('type') == 'tool.completed'])}"
            )
            
            # ===== Memory System: Async Summary Generation =====
            if MEMORY_SYSTEM_AVAILABLE and memory_options.get("auto_summarize", True):
                try:
                    asyncio.create_task(
                        _generate_summary_async(
                            user_id=int(memory_options.get("user_id", 1)),
                            session_id=session_id,
                            messages=request.messages + [
                                ChatMessage(role="assistant", content=full_content)
                            ]
                        )
                    )
                    logger.debug(f"[Memory] Triggered async summary generation for session {session_id}")
                except Exception as e:
                    logger.warning(f"[Memory] Failed to trigger summary generation: {e}")
            # ==================================================
            
        except HTTPException as he:
            logger.error(f"[SimpleChatStream] HTTPException: {he.detail}")
            yield f"event: error\ndata: {json.dumps({'code': he.status_code, 'message': he.detail, 'session_id': session_id})}\n\n"
        except Exception as e:
            logger.error(f"[SimpleChatStream] : {type(e).__name__}: {e}")
            yield f"event: error\ndata: {json.dumps({'code': 500, 'message': str(e), 'session_id': session_id})}\n\n"
    
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


# ==================== Memory System Helpers ====================

_db_pool = None

async def _get_db_pool():
    """获取数据库连接池 (延迟初始化)"""
    global _db_pool
    if _db_pool is None:
        try:
            import asyncpg
            db_url = os.getenv("DATABASE_URL") or os.getenv("MEMORY_DATABASE_URL")
            if db_url:
                _db_pool = await asyncpg.create_pool(db_url, min_size=1, max_size=10)
                logger.info("[Memory] Database pool initialized")
            else:
                logger.warning("[Memory] DATABASE_URL not set, memory system disabled")
        except Exception as e:
            logger.error(f"[Memory] Failed to initialize database pool: {e}")
    return _db_pool

async def _generate_summary_async(user_id: int, session_id: str, messages: list):
    """异步生成会话摘要"""
    try:
        from koduck.memory import process_session_summary
        
        # Convert ChatMessage to dict format expected by memory system
        message_dicts = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # Get db pool
        db_pool = await _get_db_pool()
        if not db_pool:
            return
        
        # Process summary
        result = await process_session_summary(
            user_id=user_id,
            session_id=session_id,
            messages=message_dicts,
            db_pool=db_pool
        )
        
        if result and result.get("status") == "success":
            logger.info(
                f"[Memory] Summary generated for session {session_id}, "
                f"score={result.get('value_score', 0):.2f}, type={result.get('summary_type')}"
            )
        elif result and result.get("status") == "filtered":
            logger.debug(
                f"[Memory] Summary filtered for session {session_id}, "
                f"score={result.get('score', 0):.2f}"
            )
        else:
            logger.debug(f"[Memory] Summary not generated for session {session_id}: {result}")
            
    except Exception as e:
        logger.error(f"[Memory] Failed to generate summary: {e}")

# =============================================================

def run_server(host: str = "0.0.0.0", port: int = 8000):
    """ API ."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
