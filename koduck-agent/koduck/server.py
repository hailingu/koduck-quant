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
)

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
    apiKey: str | None = Field(None, description="可选：覆盖环境变量的 API Key")
    apiBase: str | None = Field(None, description="可选：覆盖环境变量的 API Base URL")


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


async def _run_chat_with_tool_loop(
    client: Any,
    messages: list[Message],
) -> Any:
    """Execute tool-calling loop and return final assistant response."""
    history = list(messages)
    tool_round = 0
    final_response = await client.generate(history, tools=QUANT_TOOL_DEFS)

    while final_response.tool_calls and tool_round < MAX_TOOL_CALL_ROUNDS:
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
            tool_content = await execute_tool(tc.function.name, tc.function.arguments)
            history.append(
                Message(
                    role="tool",
                    tool_call_id=tc.id,
                    content=tool_content,
                )
            )
            logger.info(
                "[ToolLoop] Executed tool: name=%s id=%s",
                tc.function.name,
                tc.id,
            )

        final_response = await client.generate(history, tools=QUANT_TOOL_DEFS)

    if final_response.tool_calls:
        logger.warning(
            "[ToolLoop] Reached max rounds with remaining tool_calls: rounds=%s",
            tool_round,
        )
    return final_response


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
        response = await _run_chat_with_tool_loop(
            client,
            messages,
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
        response = await _run_chat_with_tool_loop(
            client,
            messages,
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
            client = get_client(request.provider, request.apiKey, request.apiBase, request.model)
            
            messages = _to_internal_messages(request.messages)
            
            # Send start event
            yield f"event: start\ndata: {json.dumps({'model': client.model, 'provider': request.provider})}\n\n"
            
            # Use true streaming - call LLM with generate_stream
            full_content = ""
            async for delta in client.generate_stream(messages):
                full_content += delta
                yield f"event: delta\ndata: {json.dumps({'content': delta})}\n\n"

            yield f"event: done\ndata: {json.dumps({'content': full_content, 'model': client.model, 'provider': request.provider})}\n\n"
            
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
