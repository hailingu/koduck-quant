"""OpenClaw skill market source (read-only discovery)."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import httpx

from koduck.skill_source import SkillEntry

DEFAULT_MARKET_TIMEOUT_SECONDS = 10.0


def _normalize_skill_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return normalized or "skill"


def _extract_skills(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        maybe_skills = payload.get("skills")
        if isinstance(maybe_skills, list):
            return [item for item in maybe_skills if isinstance(item, dict)]
    return []


class OpenClawSkillSource:
    """Discover public skills from an OpenClaw-compatible market catalog."""

    def __init__(self, base_url: str | None = None, enabled: bool | None = None) -> None:
        self.base_url = (base_url or os.getenv("KODUCK_SKILL_MARKET_BASE_URL", "")).rstrip("/")
        if enabled is None:
            self.enabled = os.getenv("KODUCK_SKILL_MARKET_ENABLED", "false").lower() == "true"
        else:
            self.enabled = enabled

    def discover(self) -> list[SkillEntry]:
        if not self.enabled or not self.base_url:
            return []

        url = f"{self.base_url}/skills"
        try:
            response = httpx.get(url, timeout=DEFAULT_MARKET_TIMEOUT_SECONDS)
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        discovered: list[SkillEntry] = []
        for item in _extract_skills(payload):
            skill_name = str(item.get("name") or item.get("id") or "").strip()
            if not skill_name:
                continue
            description = str(item.get("description") or "OpenClaw market skill").strip()
            version = str(item.get("version") or "").strip()
            publisher = str(item.get("publisher") or "").strip()
            artifact_url = str(item.get("artifact_url") or "").strip()
            tool_name = f"run_skill_{_normalize_skill_name(skill_name)}"

            # Read-only discovery: artifact is not installed yet.
            placeholder_script = Path(
                f"/tmp/openclaw-market/{_normalize_skill_name(skill_name)}/{version or 'latest'}/entry.py"
            )
            placeholder_skill_md = Path(
                f"/tmp/openclaw-market/{_normalize_skill_name(skill_name)}/SKILL.md"
            )

            discovered.append(
                SkillEntry(
                    tool_name=tool_name,
                    skill_name=skill_name,
                    description=description,
                    script_path=placeholder_script,
                    skill_md=placeholder_skill_md,
                    source="openclaw",
                    version=version,
                    publisher=publisher,
                    artifact_url=artifact_url,
                )
            )
        return discovered
