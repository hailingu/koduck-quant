"""LLM 客户端工厂."""

import logging

from koduck.retry import RetryConfig
from koduck.schema import LLMProvider, LLMResponse, Message
from koduck.base import LLMClientBase
from koduck.kimi_client import KimiClient
from koduck.minimax_client import MiniMaxClient
from koduck.zlm_client import ZLMClient

logger = logging.getLogger(__name__)


class LLMClient:
    """统一的 LLM 客户端包装器.
    
    根据提供商自动实例化对应的具体客户端。
    """

    def __init__(
        self,
        api_key: str,
        provider: LLMProvider = LLMProvider.KIMI,
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
        defaults = {
            LLMProvider.KIMI: {
                "api_base": api_base or "https://api.moonshot.cn/v1",
                "model": model or "moonshot-v1-8k",
            },
            LLMProvider.ZLM: {
                "api_base": api_base or "https://open.bigmodel.cn/api/paas/v4",
                "model": model or "glm-4-flash",
            },
            LLMProvider.MINIMAX: {
                "api_base": api_base or "https://api.minimax.chat/v1",
                "model": model or "MiniMax-M2.5",
            },
        }
        
        provider_defaults = defaults.get(provider, {})
        self.api_base = provider_defaults["api_base"]
        self.model = provider_defaults["model"]
        
        # 实例化具体客户端
        self._client: LLMClientBase
        if provider == LLMProvider.KIMI:
            self._client = KimiClient(
                api_key=api_key,
                api_base=self.api_base,
                model=self.model,
                retry_config=retry_config,
            )
        elif provider == LLMProvider.ZLM:
            self._client = ZLMClient(
                api_key=api_key,
                api_base=self.api_base,
                model=self.model,
                retry_config=retry_config,
            )
        elif provider == LLMProvider.MINIMAX:
            self._client = MiniMaxClient(
                api_key=api_key,
                api_base=self.api_base,
                model=self.model,
                retry_config=retry_config,
            )
        else:
            raise ValueError(f"不支持的提供商: {provider}")
        
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


def create_client(
    api_key: str | None = None,
    provider: str | LLMProvider = "kimi",
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
        >>> client = create_client(provider="minimax", model="MiniMax-M2.5")
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
