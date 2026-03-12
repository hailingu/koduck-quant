"""Tests for quant/skill tool execution."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from koduck import quant_tools
from koduck.quant_tools import execute_tool, reset_tool_runtime_context, set_tool_runtime_context


@pytest.mark.asyncio
async def test_send_qq_bot_message_requires_config() -> None:
    token = set_tool_runtime_context({})
    try:
        result_raw = await execute_tool("send_qq_bot_message", {"content": "hello"})
        result = json.loads(result_raw)
        assert result["ok"] is False
        assert "config" in result["error"].lower()
    finally:
        reset_tool_runtime_context(token)


@pytest.mark.asyncio
async def test_send_qq_bot_message_success(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload
            self.text = json.dumps(payload)

        def json(self):
            return self._payload

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, json=None, headers=None):
            if url.endswith("/app/getAppAccessToken"):
                return FakeResponse(200, {"access_token": "mock-token", "expires_in": 7200})
            return FakeResponse(200, {"id": "msg-1"})

    monkeypatch.setattr("koduck.quant_tools.httpx.AsyncClient", lambda *args, **kwargs: FakeAsyncClient())

    token = set_tool_runtime_context(
        {
            "qqBot": {
                "enabled": True,
                "appId": "102001",
                "clientSecret": "qq-secret",
                "apiBase": "https://api.sgroup.qq.com",
                "tokenPath": "/app/getAppAccessToken",
                "sendUrlTemplate": "/v2/groups/{target_id}/messages",
                "defaultTargetId": "g-openid-1",
                "targetPlaceholder": "target_id",
                "contentField": "content",
                "msgType": 0,
                "tokenTtlBufferSeconds": 60,
            }
        }
    )

    try:
        result_raw = await execute_tool(
            "send_qq_bot_message",
            {"content": "hello from agent"},
        )
    finally:
        reset_tool_runtime_context(token)

    result = json.loads(result_raw)
    assert result["ok"] is True
    assert result["status"] == 200
    assert result["response"]["id"] == "msg-1"


@pytest.mark.asyncio
async def test_skill_auto_discovery_and_execution(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    skills_root = tmp_path / "skills"
    demo_skill_dir = skills_root / "demo-skill"
    scripts_dir = demo_skill_dir / "scripts"
    scripts_dir.mkdir(parents=True)

    (demo_skill_dir / "SKILL.md").write_text(
        """---
name: demo-skill
description: \"Demo skill for discovery test\"
---

# Demo Skill
""",
        encoding="utf-8",
    )

    (scripts_dir / "demo_tool.py").write_text(
        """import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("command")
parser.add_argument("--content")
args = parser.parse_args()
print(json.dumps({"command": args.command, "content": args.content}))
""",
        encoding="utf-8",
    )

    monkeypatch.setenv("KODUCK_SKILLS_DIRS", str(skills_root))
    quant_tools.refresh_tool_registry()

    tool_names = [tool["function"]["name"] for tool in quant_tools.QUANT_TOOL_DEFS]
    assert "run_skill_demo_skill" in tool_names

    result_raw = await execute_tool(
        "run_skill_demo_skill",
        {
            "command": "ping",
            "args": {"content": "hello"},
        },
    )
    result = json.loads(result_raw)

    assert result["ok"] is True
    assert result["status"] == 0
    assert '"command": "ping"' in result["stdout"]
    assert '"content": "hello"' in result["stdout"]
