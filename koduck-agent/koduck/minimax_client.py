"""MiniMax 客户端实现.

使用 OpenAI 兼容 API 调用 MiniMax 服务.
参考文档: https://platform.minimaxi.com/docs/api-reference/text-openai-api

API 端点: https://api.minimax.chat/v1
"""

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from koduck.retry import RetryConfig, async_retry
from koduck.schema import FunctionCall, LLMResponse, Message, TokenUsage, ToolCall
from koduck.base import LLMClientBase

logger = logging.getLogger(__name__)


class MiniMaxClient(LLMClientBase):
    """MiniMax 客户端.
    
    使用 OpenAI 兼容的 API 协议调用 MiniMax 服务。
    参考: https://platform.minimaxi.com/docs/api-reference/text-openai-api
    
    支持模型:
    - MiniMax-M2.5: 最新旗舰模型（支持深度推理）
    - MiniMax-Text-01: 文本生成模型
    """

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.minimax.chat/v1",
        model: str = "MiniMax-M2.5",
        retry_config: RetryConfig | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 0.9,
    ):
        """初始化 MiniMax 客户端.
        
        Args:
            api_key: MiniMax API 密钥
            api_base: API 基础 URL (默认: https://api.minimax.chat/v1)
            model: 模型名称 (默认: MiniMax-M2.5)
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

    def _convert_simple_message(self, role: str, content: str | None) -> dict[str, Any]:
        """转换简单消息（system/user）."""
        return {"role": role, "content": content or ""}

    def _convert_tool_calls(self, tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
        """转换工具调用列表."""
        return [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": json.dumps(tc.function.arguments),
                },
            }
            for tc in tool_calls
        ]

    def _convert_assistant_message(self, msg: Message) -> dict[str, Any]:
        """转换 assistant 消息."""
        assistant_msg: dict[str, Any] = {"role": "assistant"}
        
        if msg.content:
            assistant_msg["content"] = msg.content
        
        # MiniMax M2.5 支持 reasoning_details
        if msg.thinking:
            assistant_msg["reasoning_details"] = [{"text": msg.thinking}]
        
        if msg.tool_calls:
            assistant_msg["tool_calls"] = self._convert_tool_calls(msg.tool_calls)
        
        return assistant_msg

    def _convert_tool_message(self, msg: Message) -> dict[str, Any]:
        """转换 tool 消息."""
        return {
            "role": "tool",
            "tool_call_id": msg.tool_call_id,
            "content": msg.content or "",
        }

    def _convert_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """转换为 OpenAI 格式消息."""
        # 消息转换器映射
        converters = {
            "system": lambda m: self._convert_simple_message("system", m.content),
            "user": lambda m: self._convert_simple_message("user", m.content),
            "assistant": self._convert_assistant_message,
            "tool": self._convert_tool_message,
        }
        
        api_messages = []
        for msg in messages:
            converter = converters.get(msg.role)
            if converter:
                api_messages.append(converter(msg))
        
        return api_messages

    def _convert_dict_tool(self, tool: dict[str, Any]) -> dict[str, Any]:
        """转换字典格式工具."""
        if tool.get("type") == "function":
            return tool
        return {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool.get("input_schema", tool.get("parameters", {})),
            },
        }

    def _convert_tool(self, tool: Any) -> dict[str, Any]:
        """转换单个工具为 OpenAI 格式."""
        if isinstance(tool, dict):
            return self._convert_dict_tool(tool)
        if hasattr(tool, "to_openai_schema"):
            return tool.to_openai_schema()
        raise TypeError(f"Unsupported tool type: {type(tool)}")

    def _convert_tools(self, tools: list[Any]) -> list[dict[str, Any]]:
        """转换工具为 OpenAI 格式."""
        return [self._convert_tool(tool) for tool in tools]

    def _prepare_request(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> dict[str, Any]:
        """准备请求参数."""
        params: dict[str, Any] = {
            "model": self.model,
            "messages": self._convert_messages(messages),
            "temperature": self.temperature,
            "top_p": self.top_p,
            # MiniMax M2.5 支持 reasoning_split 来分离思考内容
            "extra_body": {"reasoning_split": True},
        }
        
        if self.max_tokens:
            params["max_tokens"] = self.max_tokens
        
        if tools:
            params["tools"] = self._convert_tools(tools)
        
        return params

    def _extract_thinking(self, raw_content: str) -> tuple[str, str]:
        """从内容中提取思考部分."""
        thinking_tags = ("halle", "mu")
        if thinking_tags[0] not in raw_content or thinking_tags[1] not in raw_content:
            return "", raw_content
        
        think_start = raw_content.find(thinking_tags[0]) + len(thinking_tags[0])
        think_end = raw_content.find(thinking_tags[1])
        
        if think_start <= 0 or think_end <= think_start:
            return "", raw_content
        
        thinking = raw_content[think_start:think_end].strip()
        content = raw_content[think_end + len(thinking_tags[1]):].strip()
        return thinking, content

    def _extract_tool_calls(self, message: Any) -> list[ToolCall] | None:
        """从消息中提取工具调用."""
        if not message.tool_calls:
            return None
        
        return [
            ToolCall(
                id=tc.id,
                type="function",
                function=FunctionCall(
                    name=tc.function.name,
                    arguments=json.loads(tc.function.arguments),
                ),
            )
            for tc in message.tool_calls
        ]

    def _extract_usage(self, response: Any) -> TokenUsage | None:
        """从响应中提取 Token 使用情况."""
        if not hasattr(response, "usage") or not response.usage:
            return None
        
        return TokenUsage(
            prompt_tokens=response.usage.prompt_tokens or 0,
            completion_tokens=response.usage.completion_tokens or 0,
            total_tokens=response.usage.total_tokens or 0,
        )

    def _parse_response(self, response: Any) -> LLMResponse:
        """解析响应."""
        message = response.choices[0].message
        raw_content = message.content or ""
        
        # 提取思考内容
        thinking, content = self._extract_thinking(raw_content)
        
        return LLMResponse(
            content=content,
            thinking=thinking or None,
            tool_calls=self._extract_tool_calls(message),
            finish_reason=response.choices[0].finish_reason,
            usage=self._extract_usage(response),
        )

    async def _make_api_request(
        self,
        params: dict[str, Any],
    ) -> Any:
        """执行 API 请求."""
        logger.debug(f"MiniMax API request: model={params.get('model')}")
        # extra_body 已经包含在 params 中，直接传递
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
