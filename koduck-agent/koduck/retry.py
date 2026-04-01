"""."""

import asyncio
import logging
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class RetryConfig:
    """."""
    
    enabled: bool = True
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    retryable_exceptions: tuple[type[Exception], ...] = (
        ConnectionError,
        TimeoutError,
        Exception,  # 
    )


def async_retry(
    config: RetryConfig | None = None,
    on_retry: Callable[[int, Exception], None] | None = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """.
    
    Args:
        config: 重试配置
        on_retry: 重试回调函数，参数为 (重试次数, 异常)
    
    Returns:
        装饰器函数
    """
    cfg = config or RetryConfig()
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception: Exception | None = None
            
            for attempt in range(cfg.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # 
                    if attempt >= cfg.max_retries:
                        logger.error(
                            f"{func.__name__} failed after {cfg.max_retries + 1} attempts: {e}"
                        )
                        raise
                    
                    if not isinstance(e, cfg.retryable_exceptions):
                        raise
                    
                    # 
                    delay = min(
                        cfg.base_delay * (cfg.exponential_base ** attempt),
                        cfg.max_delay,
                    )
                    
                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    
                    if on_retry:
                        on_retry(attempt + 1, e)
                    
                    await asyncio.sleep(delay)
            
            # 
            raise last_exception or RuntimeError("Unexpected retry failure")
        
        return wrapper  # type: ignore
    
    return decorator
