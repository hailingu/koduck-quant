"""Tests for quant/skill tool execution."""

from __future__ import annotations

from pathlib import Path

import pytest

from koduck import quant_tools
from koduck.quant_tools import (
    execute_tool,
    get_tool_definition,
    list_discovered_skills,
    run_skill_command,
)
from koduck.tool_runtime import ToolRiskLevel


def test_builtin_memory_tools_registered() -> None:
    quant_tools.refresh_tool_registry()
    tool_names = [tool["function"]["name"] for tool in quant_tools.QUANT_TOOL_DEFS]
    assert "memory_set_config" in tool_names
    assert "memory_write_l1" in tool_names
    assert "memory_rebuild_l2" in tool_names
    assert "memory_rebuild_l3" in tool_names
    assert "memory_query" in tool_names
    assert "memory_cleanup" in tool_names


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
description: "Demo skill for discovery test"
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
    import json

    result = json.loads(result_raw)

    assert result["ok"] is True
    assert result["status"] == 0
    assert '"command": "ping"' in result["stdout"]
    assert '"content": "hello"' in result["stdout"]

    tool_def = get_tool_definition("run_skill_demo_skill")
    assert tool_def is not None
    assert tool_def.policy.risk_level == ToolRiskLevel.RESTRICTED
    assert tool_def.policy.timeout_seconds == 20

    skills = list_discovered_skills()
    assert any(item["skill_name"] == "demo_skill" for item in skills)

    second_result_raw = await run_skill_command(
        "demo-skill",
        "pong",
        {"content": "again"},
    )
    second_result = json.loads(second_result_raw)
    assert second_result["ok"] is True
