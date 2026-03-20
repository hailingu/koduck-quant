"""Tests for runtime events emitted by agent tool loop."""

from __future__ import annotations

import pytest

from koduck.schema import FunctionCall, LLMResponse, Message, ToolCall
from koduck.server import _run_chat_with_tool_loop


class _FakeClient:
    def __init__(self) -> None:
        self.model = "fake-model"
        self._round = 0

    async def generate(self, messages, tools=None):  # noqa: ANN001
        self._round += 1
        if self._round == 1:
            return LLMResponse(
                content="",
                tool_calls=[
                    ToolCall(
                        id="call_1",
                        type="function",
                        function=FunctionCall(name="demo_tool", arguments={"foo": "bar"}),
                    )
                ],
                finish_reason="tool_calls",
            )
        return LLMResponse(content="done", finish_reason="stop")


@pytest.mark.asyncio
async def test_tool_loop_emits_runtime_events(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_exec(name: str, arguments: dict[str, object]) -> str:
        return '{"ok": true}'

    monkeypatch.setattr("koduck.server.execute_tool", _fake_exec)

    client = _FakeClient()
    response, events, run_id = await _run_chat_with_tool_loop(
        client,
        [Message(role="user", content="hi")],
        {"enableTools": True, "emitEvents": True, "runId": "run_test"},
    )

    assert response.content == "done"
    assert run_id == "run_test"

    event_types = [evt["type"] for evt in events]
    assert "run.started" in event_types
    assert "tool.requested" in event_types
    assert "tool.completed" in event_types
    assert "run.completed" in event_types
