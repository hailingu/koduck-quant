"""DeepSeek 客户端实现.

使用 OpenAI 兼容 API 调用 DeepSeek 服务。
"""

from koduck.gpt_client import GPTClient
from koduck.retry import RetryConfig


class DeepSeekClient(GPTClient):
    """DeepSeek 客户端.

    DeepSeek 提供 OpenAI 兼容接口，可复用 GPTClient 协议实现。
    """

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.deepseek.com/v1",
        model: str = "deepseek-chat",
        retry_config: RetryConfig | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        top_p: float = 0.9,
    ):
        super().__init__(
            api_key=api_key,
            api_base=api_base,
            model=model,
            retry_config=retry_config,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
        )
