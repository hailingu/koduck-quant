"""LLM Caller - 多平台 LLM API 统一入口。

支持: MiniMax, DeepSeek, OpenAI
"""

from koduck.schema import FunctionCall, LLMResponse, Message, ToolCall

__version__ = "0.1.0"

__all__ = [
    "LLMClient",
    "create_client",
    "LLMConfig",
    "load_config",
    "Message",
    "LLMResponse",
    "ToolCall",
    "FunctionCall",
    "app",
    "run_server",
]


def __getattr__(name: str):
    if name in {"LLMConfig", "load_config"}:
        from koduck.config import LLMConfig, load_config

        return {"LLMConfig": LLMConfig, "load_config": load_config}[name]
    if name in {"LLMClient", "create_client"}:
        from koduck.client_factory import LLMClient, create_client

        return {"LLMClient": LLMClient, "create_client": create_client}[name]
    if name in {"app", "run_server"}:
        from koduck.server import app, run_server

        return {"app": app, "run_server": run_server}[name]
    raise AttributeError(f"module 'koduck' has no attribute {name!r}")
