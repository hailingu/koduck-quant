"""LLM 客户端工厂."""

import logging

from koduck.retry import RetryConfig
from koduck.schema import LLMProvider, LLMResponse, Message
from koduck.base import LLMClientBase
from koduck.minimax_client import MiniMaxClient

logger = logging.getLogger(__name__)


class LLMClient:
    """统一的 LLM 客户端包装器.
    
    根据提供商自动实例化对应的具体客户端。
    """

    def __init__(
        self,
        api_key: str,
        provider: LLMProvider = LLMProvider.MINIMAX,
        api_base: str = "",
        model: str = "",
        retry_config: RetryConfig | None = None,
    ):
        """初始化 LLM 客户端.
        
        Args:
            api_key: API 密钥
            provider: LLM 提供商
            api_base: API 基础 URL（可选，使用默认值）
            model: 模型名称（可选，使用默认值）
            retry_config: 重试配置
        """
        self.provider = provider
        
        # 应用默认值
        self.api_base = api_base or "https://api.minimax.chat/v1"
        self.model = model or "MiniMax-M2.5"
        
        # 实例化 MiniMax 客户端
        self._client: LLMClientBase
        self._client = MiniMaxClient(
            api_key=api_key,
            api_base=self.api_base,
            model=self.model,
            retry_config=retry_config,
        )
        
        logger.info(f"初始化 LLM 客户端: provider={provider}, model={self.model}")

    @property
    def retry_callback(self):
        """获取重试回调."""
        return self._client.retry_callback

    @retry_callback.setter
    def retry_callback(self, value):
        """设置重试回调."""
        self._client.retry_callback = value

    async def generate(
        self,
        messages: list[Message],
        tools: list | None = None,
    ) -> LLMResponse:
        """生成 LLM 响应.
        
        Args:
            messages: 对话消息列表
            tools: 可选的工具列表
        
        Returns:
            LLMResponse 对象
        """
        return await self._client.generate(messages, tools)

    async def generate_stream(
        self,
        messages: list[Message],
        tools: list | None = None,
    ):
        """流式生成 LLM 响应.
        
        Args:
            messages: 对话消息列表
            tools: 可选的工具列表
        
        Yields:
            流式响应块 (delta 内容)
        """
        async for delta in self._client.generate_stream(messages, tools):
            yield delta


def create_client(
    api_key: str | None = None,
    provider: str | LLMProvider = "minimax",
    api_base: str = "",
    model: str = "",
    retry_config: RetryConfig | None = None,
) -> LLMClient:
    """创建 LLM 客户端的便捷函数.
    
    Args:
        api_key: API 密钥，默认从环境变量 LLM_API_KEY 读取
        provider: 提供商名称或枚举
        api_base: API 基础 URL
        model: 模型名称
        retry_config: 重试配置
    
    Returns:
        LLMClient 实例
    
    Example:
        >>> client = create_client()
        >>> client = create_client(model="MiniMax-M2.5")
    """
    import os
    
    if api_key is None:
        api_key = os.getenv("LLM_API_KEY", "")
        if not api_key:
            raise ValueError("必须提供 api_key 或设置 LLM_API_KEY 环境变量")
    
    if isinstance(provider, str):
        provider = LLMProvider(provider.lower())
    
    return LLMClient(
        api_key=api_key,
        provider=provider,
        api_base=api_base,
        model=model,
        retry_config=retry_config,
    )
