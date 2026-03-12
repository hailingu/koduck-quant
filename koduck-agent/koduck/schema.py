"""."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class LLMProvider(str, Enum):
    """ LLM ."""
    
    MINIMAX = "minimax"     # MiniMax
    DEEPSEEK = "deepseek"   # DeepSeek
    OPENAI = "openai"       # OpenAI


@dataclass
class TokenUsage:
    """Token ."""
    
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class FunctionCall:
    """."""
    
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolCall:
    """."""
    
    id: str
    type: str  # "function"
    function: FunctionCall


@dataclass
class Message:
    """."""
    
    role: str  # "system", "user", "assistant", "tool"
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None
    thinking: str | None = None  #  ( reasoning )
    
    def to_dict(self) -> dict[str, Any]:
        """."""
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
        """."""
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
    """LLM ."""
    
    content: str
    thinking: str | None = None  # 
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: TokenUsage | None = None
