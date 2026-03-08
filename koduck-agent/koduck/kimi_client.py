"""Kimi (Moonshot AI) 客户端实现."""

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from koduck.retry import RetryConfig, async_retry
from koduck.schema import FunctionCall, LLMResponse, Message, TokenUsage, ToolCall
from koduck.base import LLMClientBase

logger = logging.getLogger(__name__)


class KimiClient(LLMClientBase):
    """Kimi (Moonshot AI) 客户端.
    
    使用 OpenAI 兼容的 API 协议。
    支持模型: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k, moonshot-v1-auto
    """

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.moonshot.cn/v1",
        model: str = "moonshot-v1-8k",
        retry_config: RetryConfig | None = None,
    ):
        """初始化 Kimi 客户端.
        
        Args:
            api_key: Moonshot API 密钥
            api_base: API 基础 URL
            model: 模型名称
            retry_config: 可选的重试配置
        """
        super().__init__(api_key, api_base, model, retry_config)
        
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=api_base,
        )

    def _convert_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """转换为 OpenAI 格式消息."""
        api_messages = []
        
        for msg in messages:
            if msg.role == "system":
                api_messages.append({"role": "system", "content": msg.content})
                continue
            
            if msg.role == "user":
                api_messages.append({"role": "user", "content": msg.content})
            
            elif msg.role == "assistant":
                assistant_msg: dict[str, Any] = {"role": "assistant"}
                
                if msg.content:
                    assistant_msg["content"] = msg.content
                
                if msg.tool_calls:
                    tool_calls_list = []
                    for tool_call in msg.tool_calls:
                        tool_calls_list.append({
                            "id": tool_call.id,
                            "type": "function",
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": json.dumps(tool_call.function.arguments),
                            },
                        })
                    assistant_msg["tool_calls"] = tool_calls_list
                
                api_messages.append(assistant_msg)
            
            elif msg.role == "tool":
                api_messages.append({
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id,
                    "content": msg.content,
                })
        
        return api_messages

    def _convert_tools(self, tools: list[Any]) -> list[dict[str, Any]]:
        """转换工具为 OpenAI 格式."""
        result = []
        for tool in tools:
            if isinstance(tool, dict):
                if "type" in tool and tool["type"] == "function":
                    result.append(tool)
                else:
                    result.append({
                        "type": "function",
                        "function": {
                            "name": tool["name"],
                            "description": tool["description"],
                            "parameters": tool.get("input_schema", tool.get("parameters", {})),
                        },
                    })
            elif hasattr(tool, "to_openai_schema"):
                result.append(tool.to_openai_schema())
            else:
                raise TypeError(f"Unsupported tool type: {type(tool)}")
        return result

    def _prepare_request(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> dict[str, Any]:
        """准备请求参数."""
        params: dict[str, Any] = {
            "model": self.model,
            "messages": self._convert_messages(messages),
        }
        
        if tools:
            params["tools"] = self._convert_tools(tools)
        
        return params

    def _parse_response(self, response: Any) -> LLMResponse:
        """解析响应."""
        message = response.choices[0].message
        
        # 提取内容
        content = message.content or ""
        
        # 提取工具调用
        tool_calls = []
        if message.tool_calls:
            for tc in message.tool_calls:
                arguments = json.loads(tc.function.arguments)
                tool_calls.append(
                    ToolCall(
                        id=tc.id,
                        type="function",
                        function=FunctionCall(
                            name=tc.function.name,
                            arguments=arguments,
                        ),
                    )
                )
        
        # 提取 Token 使用情况
        usage = None
        if hasattr(response, "usage") and response.usage:
            usage = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens or 0,
                completion_tokens=response.usage.completion_tokens or 0,
                total_tokens=response.usage.total_tokens or 0,
            )
        
        return LLMResponse(
            content=content,
            tool_calls=tool_calls if tool_calls else None,
            finish_reason=response.choices[0].finish_reason,
            usage=usage,
        )

    async def _make_api_request(
        self,
        params: dict[str, Any],
    ) -> Any:
        """执行 API 请求."""
        return await self.client.chat.completions.create(**params)

    async def generate(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> LLMResponse:
        """生成响应."""
        params = self._prepare_request(messages, tools)
        
        if self.retry_config.enabled:
            retry_decorator = async_retry(
                config=self.retry_config,
                on_retry=self.retry_callback
            )
            api_call = retry_decorator(self._make_api_request)
            response = await api_call(params)
        else:
            response = await self._make_api_request(params)
        
        return self._parse_response(response)
