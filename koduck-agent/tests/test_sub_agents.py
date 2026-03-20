"""Tests for sub-agent orchestration in runtime loop."""

from __future__ import annotations

import pytest

from koduck.schema import LLMResponse, Message
from koduck.server import _run_chat_with_tool_loop


class _SimpleClient:
    def __init__(self) -> None:
        self.model = "fake"

    async def generate(self, messages, tools=None):  # noqa: ANN001
        return LLMResponse(content="ok", finish_reason="stop")


@pytest.mark.asyncio
async def test_sub_agent_events_emitted() -> None:
    client = _SimpleClient()
    _, events, _ = await _run_chat_with_tool_loop(
        client=client,
        messages=[Message(role="user", content="hello")],
        runtime_options={
            "runId": "run_main",
            "role": "general",
            "subAgents": [{"name": "arch", "role": "architect"}, {"role": "reviewer"}],
            "mergeStrategy": "lead-agent-summary",
        },
    )

    event_types = [evt["type"] for evt in events]
    assert "agent.spawned" in event_types
    assert "agent.completed" in event_types
    assert "agent.merge.completed" in event_types
