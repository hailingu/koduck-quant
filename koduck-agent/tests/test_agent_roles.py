"""Tests for runtime role resolution and prompt injection."""

from __future__ import annotations

from koduck.agent_roles import apply_role_messages, resolve_role
from koduck.schema import Message


def test_resolve_role_fallback() -> None:
    assert resolve_role({"role": "architect"}) == "architect"
    assert resolve_role({"role": "unknown"}) == "general"
    assert resolve_role(None) == "general"


def test_apply_role_messages_injects_system_prompt() -> None:
    messages = [Message(role="user", content="hello")]
    updated = apply_role_messages(messages, "coder")
    assert updated[0].role == "system"
    assert "资深工程师" in (updated[0].content or "")
    assert updated[1].role == "user"
