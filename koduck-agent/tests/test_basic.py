"""."""

import pytest

from koduck import Message, create_client
from koduck.config import LLMConfig, load_config
from koduck.schema import LLMProvider


def test_message_creation():
    """."""
    msg = Message(role="user", content="Hello")
    assert msg.role == "user"
    assert msg.content == "Hello"


def test_llm_provider_enum():
    """ LLM ."""
    assert LLMProvider.MINIMAX.value == "minimax"
    assert LLMProvider.DEEPSEEK.value == "deepseek"
    assert LLMProvider.OPENAI.value == "openai"


def test_config_defaults():
    """."""
    config = LLMConfig(provider=LLMProvider.OPENAI)
    assert "openai" in config.api_base

    config = LLMConfig(provider=LLMProvider.MINIMAX)
    assert "minimax" in config.api_base

    config = LLMConfig(provider=LLMProvider.DEEPSEEK)
    assert "deepseek" in config.api_base
