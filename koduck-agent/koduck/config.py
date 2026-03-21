"""."""

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

from koduck.retry import RetryConfig
from koduck.schema import LLMProvider

logger = logging.getLogger(__name__)

#  .env （）
load_dotenv()

# 
_PROVIDER_DEFAULTS: dict[LLMProvider, dict[str, str]] = {
    LLMProvider.OPENAI: {
        "api_base": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    LLMProvider.MINIMAX: {
        "api_base": "https://api.minimax.chat/v1",
        "model": "MiniMax-M2.7",
    },
    LLMProvider.DEEPSEEK: {
        "api_base": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
}


@dataclass
class LLMConfig:
    """LLM ."""
    
    provider: LLMProvider = LLMProvider.MINIMAX
    api_key: str = ""
    api_base: str = ""
    model: str = ""
    retry: RetryConfig = field(default_factory=RetryConfig)
    
    def __post_init__(self) -> None:
        """（）."""
        defaults = _PROVIDER_DEFAULTS.get(self.provider, {})
        if not self.api_base:
            self.api_base = defaults.get("api_base", "")
        if not self.model:
            self.model = defaults.get("model", "")


def _parse_retry_config(retry_cfg: dict | None) -> RetryConfig:
    """.
    
    Args:
        retry_cfg: 配置文件中的 retry 字段
        
    Returns:
        RetryConfig 对象
    """
    if not retry_cfg:
        return RetryConfig()
    
    return RetryConfig(
        enabled=retry_cfg.get("enabled", True),
        max_retries=retry_cfg.get("max_retries", 3),
        base_delay=retry_cfg.get("base_delay", 1.0),
        max_delay=retry_cfg.get("max_delay", 60.0),
        exponential_base=retry_cfg.get("exponential_base", 2.0),
    )


def load_config(config_path: str | Path | None = None) -> LLMConfig:
    """.
    
    配置优先级 (从高到低):
    1. 环境变量
    2. 配置文件
    3. 默认值
    
    Args:
        config_path: 配置文件路径，默认为 ~/.llm_caller/config.yaml
        
    Returns:
        LLMConfig 对象
    """
    # 
    if config_path is None:
        config_path = Path.home() / ".llm_caller" / "config.yaml"
    else:
        config_path = Path(config_path)
    
    # Step 1: （）
    file_config: dict = {}
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                file_config = yaml.safe_load(f) or {}
            logger.debug(": %s", config_path)
        except (yaml.YAMLError, OSError) as e:
            logger.warning(": %s - %s", config_path, e)
    
    # Step 2: （）
    provider_str = os.getenv("LLM_PROVIDER") or file_config.get("provider", "minimax")
    provider = LLMProvider(provider_str.lower())
    
    api_key = os.getenv("LLM_API_KEY") or file_config.get("api_key", "")
    #  API Base URL
    api_base = os.getenv("LLM_API_BASE") or file_config.get("api_base", "")
    # MiniMax  API Base URL
    model = os.getenv("LLM_MODEL") or file_config.get("model", "")
    
    # Step 3: 
    retry = _parse_retry_config(file_config.get("retry"))
    
    config = LLMConfig(
        provider=provider,
        api_key=api_key,
        api_base=api_base,
        model=model,
        retry=retry,
    )
    
    logger.debug(
        "配置加载完成: provider=%s, model=%s, api_base=%s",
        config.provider.value,
        config.model,
        config.api_base,
    )
    
    return config


def save_config_example(path: str | Path | None = None) -> None:
    """.
    
    Args:
        path: 保存路径，默认为 ./config-example.yaml
    """
    if path is None:
        path = Path("config-example.yaml")
    else:
        path = Path(path)
    
    example = """# LLM Caller 

# : minimax
provider: minimax

# API  ()
# : export LLM_API_KEY=your_key
api_key: "your-api-key-here"

# API Base URL (，)
# openai: https://api.openai.com/v1
# minimax: https://api.minimax.chat/v1
# deepseek: https://api.deepseek.com/v1
api_base: ""

#  (，)
# openai: gpt-4o-mini, gpt-4o
# minimax: MiniMax-M2.7, MiniMax-Text-01, abab6.5s-chat
# deepseek: deepseek-chat, deepseek-reasoner
model: ""

# 
retry:
  enabled: true
  max_retries: 3
  base_delay: 1.0
  max_delay: 60.0
  exponential_base: 2.0
"""
    
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(example)
    
    print(f": {path.absolute()}")
