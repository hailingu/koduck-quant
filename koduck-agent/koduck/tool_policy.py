"""Tool policy checks and audit helpers."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from koduck.quant_tools import get_tool_definition
from koduck.tool_runtime import ToolRiskLevel

DEFAULT_AUDIT_LOG_PATH = "/tmp/koduck_tool_audit.log"


def can_execute_tool(tool_name: str, runtime: dict[str, Any] | None) -> tuple[bool, str]:
    """Return policy decision for one tool call."""
    runtime = runtime or {}
    allow_tools = runtime.get("allowTools")
    deny_tools = runtime.get("denyTools")
    allow_restricted = bool(runtime.get("allowRestrictedTools", False))
    allow_market_skills = bool(runtime.get("allowMarketSkills", False))
    allowed_skill_sources = runtime.get("allowedSkillSources")
    allowed_skill_publishers = runtime.get("allowedSkillPublishers")
    pinned_skill_versions = runtime.get("pinnedSkillVersions")

    if isinstance(allow_tools, list) and allow_tools and tool_name not in allow_tools:
        return False, "tool not in runtime allow-list"
    if isinstance(deny_tools, list) and tool_name in deny_tools:
        return False, "tool in runtime deny-list"

    tool_def = get_tool_definition(tool_name)
    if tool_def is None:
        return False, "tool not registered"

    metadata = tool_def.metadata or {}
    source = str(metadata.get("source") or "")
    publisher = str(metadata.get("publisher") or "")
    version = str(metadata.get("version") or "")

    if source == "openclaw" and not allow_market_skills:
        return False, "market skill requires allowMarketSkills=true"

    if isinstance(allowed_skill_sources, list) and allowed_skill_sources:
        if source and source not in {str(x) for x in allowed_skill_sources}:
            return False, "skill source not in runtime allowedSkillSources"

    if isinstance(allowed_skill_publishers, list) and allowed_skill_publishers:
        if publisher not in {str(x) for x in allowed_skill_publishers}:
            return False, "skill publisher not in runtime allowedSkillPublishers"

    if isinstance(pinned_skill_versions, dict) and pinned_skill_versions:
        pinned = str(pinned_skill_versions.get(tool_name) or "")
        if pinned and version and pinned != version:
            return False, "skill version not matching runtime pinnedSkillVersions"

    if tool_def.policy.risk_level == ToolRiskLevel.DANGEROUS:
        return False, "dangerous tool is blocked by default"
    if tool_def.policy.risk_level == ToolRiskLevel.RESTRICTED and not allow_restricted:
        return False, "restricted tool requires allowRestrictedTools=true"

    return True, "allowed"


def append_tool_audit(
    *,
    run_id: str,
    tool_name: str,
    tool_call_id: str,
    allowed: bool,
    reason: str,
    elapsed_ms: int | None,
    source: str = "",
    publisher: str = "",
    version: str = "",
    checksum: str = "",
) -> None:
    """Append one line of JSON audit record."""
    path = Path(os.getenv("KODUCK_TOOL_AUDIT_LOG", DEFAULT_AUDIT_LOG_PATH))
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "tool_name": tool_name,
        "tool_call_id": tool_call_id,
        "allowed": allowed,
        "reason": reason,
        "elapsed_ms": elapsed_ms,
        "source": source,
        "publisher": publisher,
        "version": version,
        "checksum": checksum,
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_tool_audits(limit: int = 100) -> list[dict[str, Any]]:
    """Read recent audit records from audit log file."""
    path = Path(os.getenv("KODUCK_TOOL_AUDIT_LOG", DEFAULT_AUDIT_LOG_PATH))
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    selected = lines[-max(1, limit) :]
    result: list[dict[str, Any]] = []
    for line in selected:
        try:
            parsed = json.loads(line)
        except Exception:
            continue
        if isinstance(parsed, dict):
            result.append(parsed)
    return result
