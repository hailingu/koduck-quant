"""Tests for tool policy and audit behavior."""

from __future__ import annotations

from pathlib import Path

from koduck import quant_tools
from koduck.tool_policy import append_tool_audit, can_execute_tool, read_tool_audits


def test_restricted_skill_blocked_without_runtime_flag(
    monkeypatch, tmp_path: Path
) -> None:
    skills_root = tmp_path / "skills"
    demo_skill_dir = skills_root / "demo-skill"
    scripts_dir = demo_skill_dir / "scripts"
    scripts_dir.mkdir(parents=True)

    (demo_skill_dir / "SKILL.md").write_text(
        """---
name: demo-skill
description: "Demo skill for policy test"
---
""",
        encoding="utf-8",
    )
    (scripts_dir / "demo_tool.py").write_text("print('ok')\n", encoding="utf-8")

    monkeypatch.setenv("KODUCK_SKILLS_DIRS", str(skills_root))
    quant_tools.refresh_tool_registry()

    allowed, reason = can_execute_tool("run_skill_demo_skill", runtime={})
    assert allowed is False
    assert "restricted" in reason

    allowed, _ = can_execute_tool(
        "run_skill_demo_skill", runtime={"allowRestrictedTools": True}
    )
    assert allowed is True


def test_tool_audit_append_and_read(monkeypatch, tmp_path: Path) -> None:
    audit_path = tmp_path / "audit.log"
    monkeypatch.setenv("KODUCK_TOOL_AUDIT_LOG", str(audit_path))

    append_tool_audit(
        run_id="run_1",
        tool_name="demo_tool",
        tool_call_id="call_1",
        allowed=True,
        reason="allowed",
        elapsed_ms=12,
    )
    records = read_tool_audits(limit=10)

    assert len(records) == 1
    assert records[0]["run_id"] == "run_1"
    assert records[0]["tool_name"] == "demo_tool"
