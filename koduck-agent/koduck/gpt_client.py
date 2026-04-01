"""GPT (OpenAI compatible) .

支持使用 OpenAI 兼容 API 的 GPT 服务，如 https://api.gptsapi.net
"""

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from koduck.retry import RetryConfig, async_retry
from koduck.schema import FunctionCall, LLMResponse, Message, TokenUsage, ToolCall
from koduck.base import LLMClientBase

logger = logging.getLogger(__name__)


class GPTClient(LLMClientBase):
    """GPT (OpenAI compatible) .
    
    使用 OpenAI 兼容的 API 协议。
    
    支持模型:
    - gpt-5.4
    """

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.gptsapi.net",
        model: str = "gpt-5.4",
        retry_config: RetryConfig | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 0.9,
    ):
        """ GPT .
        
        Args:
            api_key: API 密钥
            api_base: API 基础 URL (默认: https://api.gptsapi.net)
            model: 模型名称 (默认: gpt-5.4)
            retry_config: 可选的重试配置
            temperature: 采样温度 (0-2, 默认 0.7)
            max_tokens: 最大生成 token 数 (默认 None)
            top_p: 核采样参数 (0-1, 默认 0.9)
        """
        super().__init__(api_key, api_base, model, retry_config)
        
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=api_base,
        )

    def _convert_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """ OpenAI ."""
        api_messages = []
        
        for msg in messages:
            if msg.role == "system":
                api_messages.append({
                    "role": "system",
                    "content": msg.content or "",
                })
            elif msg.role == "user":
                api_messages.append({
                    "role": "user",
                    "content": msg.content or "",
                })
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
                    "content": msg.content or "",
                })
        
        return api_messages

    def _convert_tools(self, tools: list[Any]) -> list[dict[str, Any]]:
        """ OpenAI ."""
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
        """."""
        params: dict[str, Any] = {
            "model": self.model,
            "messages": self._convert_messages(messages),
            "temperature": self.temperature,
            "top_p": self.top_p,
        }
        
        if self.max_tokens:
            params["max_tokens"] = self.max_tokens
        
        if tools:
            params["tools"] = self._convert_tools(tools)
        
        return params

    def _parse_response(self, response: Any) -> LLMResponse:
        """."""
        message = response.choices[0].message
        
        # 
        content = message.content or ""
        
        # 
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
        
        #  Token 
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
        """ API ."""
        logger.debug(f"GPT API request: model={params.get('model')}")
        return await self.client.chat.completions.create(**params)

    async def generate(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> LLMResponse:
        """."""
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
