"""配置管理."""

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

from koduck.retry import RetryConfig
from koduck.schema import LLMProvider

logger = logging.getLogger(__name__)

# 加载 .env 文件（如果存在）
load_dotenv()

# 类级别默认配置常量
_PROVIDER_DEFAULTS: dict[LLMProvider, dict[str, str]] = {
    LLMProvider.KIMI: {
        "api_base": "https://api.moonshot.cn/v1",
        "model": "moonshot-v1-8k",
    },
    LLMProvider.ZLM: {
        "api_base": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-5",
    },
    LLMProvider.MINIMAX: {
        "api_base": "https://api.minimax.chat/v1",
        "model": "MiniMax-M2.5",
    },
}


@dataclass
class LLMConfig:
    """LLM 配置."""
    
    provider: LLMProvider = LLMProvider.KIMI
    api_key: str = ""
    api_base: str = ""
    model: str = ""
    retry: RetryConfig = field(default_factory=RetryConfig)
    
    def __post_init__(self) -> None:
        """应用默认值（仅对空值进行填充）."""
        defaults = _PROVIDER_DEFAULTS.get(self.provider, {})
        if not self.api_base:
            self.api_base = defaults.get("api_base", "")
        if not self.model:
            self.model = defaults.get("model", "")


def _parse_retry_config(retry_cfg: dict | None) -> RetryConfig:
    """解析重试配置.
    
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
    """加载配置.
    
    配置优先级 (从高到低):
    1. 环境变量
    2. 配置文件
    3. 默认值
    
    Args:
        config_path: 配置文件路径，默认为 ~/.llm_caller/config.yaml
        
    Returns:
        LLMConfig 对象
    """
    # 确定配置文件路径
    if config_path is None:
        config_path = Path.home() / ".llm_caller" / "config.yaml"
    else:
        config_path = Path(config_path)
    
    # Step 1: 从配置文件读取（最低优先级）
    file_config: dict = {}
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                file_config = yaml.safe_load(f) or {}
            logger.debug("已加载配置文件: %s", config_path)
        except (yaml.YAMLError, OSError) as e:
            logger.warning("加载配置文件失败: %s - %s", config_path, e)
    
    # Step 2: 合并配置（环境变量优先于配置文件）
    provider_str = os.getenv("LLM_PROVIDER") or file_config.get("provider", "kimi")
    provider = LLMProvider(provider_str.lower())
    
    api_key = os.getenv("LLM_API_KEY") or file_config.get("api_key", "")
    api_base = os.getenv("LLM_API_BASE") or file_config.get("api_base", "")
    model = os.getenv("LLM_MODEL") or file_config.get("model", "")
    
    # Step 3: 构建配置对象
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
    """保存配置示例文件.
    
    Args:
        path: 保存路径，默认为 ./config-example.yaml
    """
    if path is None:
        path = Path("config-example.yaml")
    else:
        path = Path(path)
    
    example = """# LLM Caller 配置文件示例

# 提供商: kimi / zlm / minimax
provider: kimi

# API 密钥 (必需)
# 可以从环境变量设置: export LLM_API_KEY=your_key
api_key: "your-api-key-here"

# API Base URL (可选，会使用默认值)
# kimi: https://api.moonshot.cn/v1
# zlm: https://open.bigmodel.cn/api/paas/v4
# minimax: https://api.minimax.chat/v1
api_base: ""

# 模型名称 (可选，会使用默认值)
# kimi: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
# zlm: glm-4-flash, glm-4, glm-4-plus
# minimax: MiniMax-Text-01, abab6.5s-chat
model: ""

# 重试配置
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
    
    print(f"配置示例已保存到: {path.absolute()}")