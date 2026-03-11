"""OpenAI 客户端实现.

使用 OpenAI 官方 API 调用。
"""

from koduck.gpt_client import GPTClient
from koduck.retry import RetryConfig


class OpenAIClient(GPTClient):
    """OpenAI 客户端.

    复用 OpenAI 兼容协议实现，默认使用 OpenAI 官方端点。
    """

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.openai.com/v1",
        model: str = "gpt-5.4",
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
