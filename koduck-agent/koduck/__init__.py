"""LLM Caller - 程序化调用多平台 LLM API 的统一接口.

支持: MiniMax, DeepSeek, OpenAI
"""

from koduck.config import LLMConfig, load_config
from koduck.client_factory import LLMClient, create_client
from koduck.schema import Message, LLMResponse, ToolCall, FunctionCall

__version__ = "0.1.0"

from koduck.server import app, run_server

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
