"""LLM 客户端基类."""

from abc import ABC, abstractmethod
from typing import Any

from koduck.retry import RetryConfig
from koduck.schema import LLMResponse, Message


class LLMClientBase(ABC):
    """LLM 客户端抽象基类.
    
    所有具体 LLM 客户端都必须继承此类并实现 generate 方法.
    """

    def __init__(
        self,
        api_key: str,
        api_base: str,
        model: str,
        retry_config: RetryConfig | None = None,
    ):
        """初始化 LLM 客户端.
        
        Args:
            api_key: API 密钥
            api_base: API 基础 URL
            model: 模型名称
            retry_config: 可选的重试配置
        """
        self.api_key = api_key
        self.api_base = api_base.rstrip("/")
        self.model = model
        self.retry_config = retry_config or RetryConfig()
        
        # 重试回调
        self.retry_callback: Any = None

    @abstractmethod
    async def generate(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> LLMResponse:
        """生成 LLM 响应.
        
        Args:
            messages: 对话消息列表
            tools: 可选的工具列表
        
        Returns:
            LLMResponse 对象
        """
        pass

    @abstractmethod
    def _prepare_request(
        self,
        messages: list[Message],
        tools: list[Any] | None = None,
    ) -> dict[str, Any]:
        """准备 API 请求.
        
        Args:
            messages: 对话消息列表
            tools: 可选的工具列表
        
        Returns:
            请求参数字典
        """
        pass

    @abstractmethod
    def _convert_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """转换消息格式.
        
        Args:
            messages: 内部 Message 对象列表
        
        Returns:
            API 特定的消息格式列表
        """
        pass
