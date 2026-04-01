"""MiniMax .

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
    """MiniMax .
    
    使用 OpenAI 兼容的 API 协议调用 MiniMax 服务。
    参考: https://platform.minimaxi.com/docs/api-reference/text-openai-api
    
    支持模型:
    - MiniMax-M2.7: 最新旗舰模型（支持深度推理）
    - MiniMax-Text-01: 文本生成模型
    """

    # 
    SUPPORTED_MODELS = [
        "MiniMax-M2.7",
        "MiniMax-M2.5",
        "MiniMax-Text-01",
        "MiniMax-M1",
        "abab6.5s-chat",
        "abab6-chat",
    ]

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.minimax.chat/v1",
        model: str = "MiniMax-M2.7",
        retry_config: RetryConfig | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 0.9,
    ):
        """ MiniMax .
        
        Args:
            api_key: MiniMax API 密钥
            api_base: API 基础 URL (默认: https://api.minimax.chat/v1)
            model: 模型名称 (默认: MiniMax-Text-01)
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
        """（system/user）."""
        return {"role": role, "content": content or ""}

    def _convert_tool_calls(self, tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
        """."""
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
        """ assistant ."""
        assistant_msg: dict[str, Any] = {"role": "assistant"}
        
        if msg.content:
            assistant_msg["content"] = msg.content
        
        # MiniMax M2.5  reasoning_details
        if msg.thinking:
            assistant_msg["reasoning_details"] = [{"text": msg.thinking}]
        
        if msg.tool_calls:
            assistant_msg["tool_calls"] = self._convert_tool_calls(msg.tool_calls)
        
        return assistant_msg

    def _convert_tool_message(self, msg: Message) -> dict[str, Any]:
        """ tool ."""
        return {
            "role": "tool",
            "tool_call_id": msg.tool_call_id,
            "content": msg.content or "",
        }

    def _convert_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """ OpenAI ."""
        # 
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
        """."""
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
        """ OpenAI ."""
        if isinstance(tool, dict):
            return self._convert_dict_tool(tool)
        if hasattr(tool, "to_openai_schema"):
            return tool.to_openai_schema()
        raise TypeError(f"Unsupported tool type: {type(tool)}")

    def _convert_tools(self, tools: list[Any]) -> list[dict[str, Any]]:
        """ OpenAI ."""
        return [self._convert_tool(tool) for tool in tools]

    def _prepare_request(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> dict[str, Any]:
        """."""
        api_messages = self._convert_messages(messages)
        params: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "temperature": self.temperature,
            "top_p": self.top_p,
            # MiniMax  reasoning_split 
            "extra_body": {"reasoning_split": True} if "M2.7" in self.model or "M2.5" in self.model or "M1" in self.model else {},
        }
        
        if self.max_tokens:
            params["max_tokens"] = self.max_tokens
        
        if tools:
            params["tools"] = self._convert_tools(tools)
        
        logger.info(f"[MiniMax] : model={self.model}, messages_count={len(api_messages)}")
        for i, msg in enumerate(api_messages):
            content_preview = msg.get('content', '')[:50] + "..." if msg.get('content') and len(msg.get('content', '')) > 50 else msg.get('content', '')
            logger.info(f"[MiniMax]  Message[{i}]: role={msg.get('role')}, content={content_preview}")
        
        return params

    def _extract_thinking(self, raw_content: str) -> tuple[str, str]:
        """."""
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
        """."""
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
        """ Token ."""
        if not hasattr(response, "usage") or not response.usage:
            return None
        
        return TokenUsage(
            prompt_tokens=response.usage.prompt_tokens or 0,
            completion_tokens=response.usage.completion_tokens or 0,
            total_tokens=response.usage.total_tokens or 0,
        )

    def _parse_response(self, response: Any) -> LLMResponse:
        """."""
        message = response.choices[0].message
        raw_content = message.content or ""
        
        logger.info(f"[MiniMax] parse_response: finish_reason={response.choices[0].finish_reason}")
        logger.info(f"[MiniMax] parse_response: raw_content_length={len(raw_content)}")
        logger.info(
            f"[MiniMax] parse_response: raw_content_preview={raw_content[:200]}..."
            if len(raw_content) > 200
            else f"[MiniMax] parse_response: raw_content_preview={raw_content}"
        )
        
        # 
        thinking, content = self._extract_thinking(raw_content)
        
        logger.info(f"[MiniMax] parse_response: content_length={len(content)}, has_thinking={bool(thinking)}")
        if thinking:
            logger.info(
                f"[MiniMax] parse_response: thinking_preview={thinking[:100]}..."
                if len(thinking) > 100
                else f"[MiniMax] parse_response: thinking_preview={thinking}"
            )
        
        result = LLMResponse(
            content=content,
            thinking=thinking or None,
            tool_calls=self._extract_tool_calls(message),
            finish_reason=response.choices[0].finish_reason,
            usage=self._extract_usage(response),
        )
        
        logger.info(f"[MiniMax] LLMResponse: content_length={len(result.content) if result.content else 0}, finish_reason={result.finish_reason}")
        return result

    async def _make_api_request(
        self,
        params: dict[str, Any],
    ) -> Any:
        """ API ."""
        logger.info(f"[MiniMax]  API : model={params.get('model')}, api_base={self.api_base}")
        try:
            # extra_body  params ，
            response = await self.client.chat.completions.create(**params)
            logger.info(f"[MiniMax] API ")
            logger.info(f"[MiniMax] : id={response.id}, model={response.model}, choices_count={len(response.choices)}")
            if response.usage:
                logger.info(f"[MiniMax] Token : prompt={response.usage.prompt_tokens}, completion={response.usage.completion_tokens}, total={response.usage.total_tokens}")
            return response
        except Exception as e:
            logger.error(f"[MiniMax] API : {type(e).__name__}: {e}")
            logger.error(f"[MiniMax] : {repr(e)}")
            # 
            raise

    async def generate(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> LLMResponse:
        """."""
        logger.info(f"[MiniMax] generate() : messages_count={len(messages)}, retry_enabled={self.retry_config.enabled}")
        
        params = self._prepare_request(messages, tools)
        
        try:
            if self.retry_config.enabled:
                logger.info(f"[MiniMax] ")
                retry_decorator = async_retry(
                    config=self.retry_config,
                    on_retry=self.retry_callback
                )
                api_call = retry_decorator(self._make_api_request)
                response = await api_call(params)
            else:
                logger.info(f"[MiniMax]  API")
                response = await self._make_api_request(params)
            
            result = self._parse_response(response)
            logger.info(f"[MiniMax] generate() ")
            return result
        except Exception as e:
            logger.error(f"[MiniMax] generate() : {type(e).__name__}: {e}")
            raise

    async def generate_stream(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ):
        """.
        
        Yields:
            流式响应块 (delta 内容)
        """
        logger.info(f"[MiniMax] generate_stream() : messages_count={len(messages)}")
        
        params = self._prepare_request(messages, tools)
        params["stream"] = True
        
        try:
            logger.info(f"[MiniMax]  API : model={params.get('model')}")
            stream = await self.client.chat.completions.create(**params)
            
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    logger.debug(f"[MiniMax] : {delta.content[:50]}..." if len(delta.content) > 50 else f"[MiniMax] : {delta.content}")
                    yield delta.content
                
                # 
                if chunk.choices and chunk.choices[0].finish_reason:
                    logger.info(f"[MiniMax] : finish_reason={chunk.choices[0].finish_reason}")
                    break
                    
        except Exception as e:
            logger.error(f"[MiniMax] generate_stream() : {type(e).__name__}: {e}")
            raise
