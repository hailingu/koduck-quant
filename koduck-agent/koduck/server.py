"""FastAPI REST API 服务.

提供 OpenAI 兼容的 REST API 接口，允许外部服务通过 HTTP 调用 LLM。

Usage:
    uvicorn koduck.server:app --reload
    python -m koduck.server
"""

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from koduck import __version__, create_client
from koduck.schema import LLMProvider, Message

logger = logging.getLogger(__name__)

# 全局客户端缓存
_clients: dict[str, Any] = {}


def get_client(provider: str) -> Any:
    """获取或创建客户端实例."""
    if provider not in _clients:
        try:
            _clients[provider] = create_client(provider=provider)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    return _clients[provider]


# API 模型定义
class ChatMessage(BaseModel):
    """聊天消息模型."""
    role: str = Field(..., description="消息角色: system/user/assistant/tool")
    content: str | None = Field(None, description="消息内容")
    thinking: str | None = Field(None, description="思考内容（仅 assistant）")
    tool_call_id: str | None = Field(None, description="工具调用 ID（仅 tool）")


class ChatCompletionRequest(BaseModel):
    """聊天补全请求模型."""
    model: str | None = Field(None, description="模型名称")
    messages: list[ChatMessage] = Field(..., description="消息列表")
    provider: str = Field("kimi", description="LLM 提供商: kimi/zlm/minimax")
    temperature: float | None = Field(None, description="采样温度")
    max_tokens: int | None = Field(None, description="最大生成 token 数")
    stream: bool = Field(False, description="是否流式输出（暂不支持）")

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "kimi",
                "messages": [
                    {"role": "user", "content": "你好，请介绍一下你自己"}
                ]
            }
        }


class ChatCompletionResponse(BaseModel):
    """聊天补全响应模型."""
    id: str = Field(default="chatcmpl-koduck", description="响应 ID")
    object: str = Field(default="chat.completion", description="对象类型")
    created: int = Field(default=0, description="创建时间戳")
    model: str = Field(..., description="使用的模型")
    provider: str = Field(..., description="使用的提供商")
    choices: list[dict] = Field(..., description="响应选项")
    usage: dict | None = Field(None, description="Token 使用情况")


class HealthResponse(BaseModel):
    """健康检查响应."""
    status: str = Field(default="ok", description="服务状态")
    version: str = Field(..., description="服务版本")


class ModelsResponse(BaseModel):
    """模型列表响应."""
    models: list[dict] = Field(..., description="可用模型列表")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理."""
    # 启动时
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    logger.info(f"Koduck API Server v{__version__} starting...")
    yield
    # 关闭时
    logger.info("Koduck API Server shutting down...")


# 创建 FastAPI 应用
app = FastAPI(
    title="Koduck API",
    description="多平台 LLM 统一调用接口 - OpenAI 兼容 API",
    version=__version__,
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """健康检查接口."""
    return HealthResponse(version=__version__)


@app.get("/v1/models", response_model=ModelsResponse, tags=["Chat"])
async def list_models():
    """列出可用模型."""
    models = []
    for provider in LLMProvider:
        if provider == LLMProvider.KIMI:
            models.extend([
                {"id": "moonshot-v1-8k", "provider": "kimi", "name": "Kimi 8K"},
                {"id": "moonshot-v1-32k", "provider": "kimi", "name": "Kimi 32K"},
                {"id": "moonshot-v1-128k", "provider": "kimi", "name": "Kimi 128K"},
            ])
        elif provider == LLMProvider.ZLM:
            models.extend([
                {"id": "glm-4-flash", "provider": "zlm", "name": "GLM-4 Flash"},
                {"id": "glm-4", "provider": "zlm", "name": "GLM-4"},
                {"id": "glm-4-plus", "provider": "zlm", "name": "GLM-4 Plus"},
            ])
        elif provider == LLMProvider.MINIMAX:
            models.extend([
                {"id": "MiniMax-M2.5", "provider": "minimax", "name": "MiniMax M2.5"},
                {"id": "MiniMax-Text-01", "provider": "minimax", "name": "MiniMax Text"},
            ])
    return ModelsResponse(models=models)


@app.post("/v1/chat/completions", response_model=ChatCompletionResponse, tags=["Chat"])
async def chat_completions(request: ChatCompletionRequest):
    """聊天补全接口（OpenAI 兼容）.
    
    支持的提供商:
    - kimi: Moonshot AI
    - zlm: 智谱 AI
    - minimax: MiniMax
    
    示例请求:
    ```json
    {
        "provider": "kimi",
        "messages": [
            {"role": "user", "content": "你好"}
        ]
    }
    ```
    """
    if request.stream:
        raise HTTPException(
            status_code=501,
            detail="流式输出暂不支持，请设置 stream=false"
        )

    # 获取客户端
    client = get_client(request.provider)

    # 转换消息格式
    messages = [
        Message(
            role=msg.role,
            content=msg.content,
            thinking=msg.thinking,
            tool_call_id=msg.tool_call_id,
        )
        for msg in request.messages
    ]

    try:
        # 调用 LLM
        response = await client.generate(messages)

        # 构建响应
        choice = {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": response.content,
            },
            "finish_reason": response.finish_reason,
        }

        # 添加思考内容（如果有）
        if response.thinking:
            choice["message"]["thinking"] = response.thinking

        # 添加工具调用（如果有）
        if response.tool_calls:
            choice["message"]["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    }
                }
                for tc in response.tool_calls
            ]

        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }

        return ChatCompletionResponse(
            model=client.model,
            provider=request.provider,
            choices=[choice],
            usage=usage,
        )

    except Exception as e:
        logger.error(f"Chat completion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP 异常处理."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "type": "api_error"}},
    )


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """启动 API 服务器."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()