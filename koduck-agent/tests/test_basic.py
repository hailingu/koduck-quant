"""基本功能测试."""

import pytest

from koduck import Message, create_client
from koduck.config import LLMConfig, load_config
from koduck.schema import LLMProvider


def test_message_creation():
    """测试消息创建."""
    msg = Message(role="user", content="Hello")
    assert msg.role == "user"
    assert msg.content == "Hello"


def test_llm_provider_enum():
    """测试 LLM 提供商枚举."""
    assert LLMProvider.KIMI.value == "kimi"
    assert LLMProvider.ZLM.value == "zlm"
    assert LLMProvider.MINIMAX.value == "minimax"


def test_config_defaults():
    """测试配置默认值."""
    config = LLMConfig(provider=LLMProvider.KIMI)
    assert "moonshot" in config.api_base
    
    config = LLMConfig(provider=LLMProvider.ZLM)
    assert "bigmodel" in config.api_base
    
    config = LLMConfig(provider=LLMProvider.MINIMAX)
    assert "minimax" in config.api_base
