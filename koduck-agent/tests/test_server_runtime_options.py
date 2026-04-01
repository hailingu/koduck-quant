"""Tests for runtimeOptions passthrough on API handlers."""

from __future__ import annotations

import pytest

from koduck.schema import LLMResponse
from koduck.server import SimpleChatRequest, simple_chat


class _FakeClient:
    model = "fake-model"


@pytest.mark.asyncio
async def test_simple_chat_passes_runtime_options(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def _fake_get_client(provider: str, api_key=None, api_base=None, model_override=None):  # noqa: ANN001, ANN202
        return _FakeClient()

    async def _fake_tool_loop(client, messages, runtime_options):  # noqa: ANN001, ANN202
        captured["runtime_options"] = runtime_options
        return LLMResponse(content="ok", finish_reason="stop"), [], "run_test"

    monkeypatch.setattr("koduck.server.get_client", _fake_get_client)
    monkeypatch.setattr("koduck.server._run_chat_with_tool_loop", _fake_tool_loop)

    request = SimpleChatRequest(
        provider="openai",
        messages=[{"role": "user", "content": "hi"}],
        runtimeOptions={
            "allowRestrictedTools": True,
            "allowMarketSkills": True,
            "allowedSkillPublishers": ["openclaw"],
        },
    )
    response = await simple_chat(request)
    assert response.code == 0
    assert captured["runtime_options"] == request.runtimeOptions
