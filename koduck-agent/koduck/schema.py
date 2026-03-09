"""数据模型定义."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class LLMProvider(str, Enum):
    """支持的 LLM 提供商."""
    
    MINIMAX = "minimax"     # MiniMax


@dataclass
class TokenUsage:
    """Token 使用情况."""
    
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class FunctionCall:
    """函数调用定义."""
    
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolCall:
    """工具调用."""
    
    id: str
    type: str  # "function"
    function: FunctionCall


@dataclass
class Message:
    """对话消息."""
    
    role: str  # "system", "user", "assistant", "tool"
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None
    thinking: str | None = None  # 思考内容 (适用于支持 reasoning 的模型)
    
    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式."""
        result: dict[str, Any] = {"role": self.role}
        
        if self.content is not None:
            result["content"] = self.content
        if self.thinking is not None:
            result["thinking"] = self.thinking
        if self.tool_calls is not None:
            result["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in self.tool_calls
            ]
        if self.tool_call_id is not None:
            result["tool_call_id"] = self.tool_call_id
            
        return result
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Message":
        """从字典创建消息."""
        tool_calls = None
        if "tool_calls" in data:
            tool_calls = [
                ToolCall(
                    id=tc["id"],
                    type=tc["type"],
                    function=FunctionCall(
                        name=tc["function"]["name"],
                        arguments=tc["function"]["arguments"],
                    ),
                )
                for tc in data["tool_calls"]
            ]
        
        return cls(
            role=data["role"],
            content=data.get("content"),
            tool_calls=tool_calls,
            tool_call_id=data.get("tool_call_id"),
            thinking=data.get("thinking"),
        )


@dataclass
class LLMResponse:
    """LLM 响应."""
    
    content: str
    thinking: str | None = None  # 思考内容
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: TokenUsage | None = None
