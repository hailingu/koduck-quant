"""Skill source protocol and shared discovery models."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class SkillEntry:
    """One discovered executable skill entry."""

    tool_name: str
    skill_name: str
    description: str
    script_path: Path
    skill_md: Path
    source: str = "local"
    version: str = ""
    publisher: str = ""
    artifact_url: str = ""
    checksum: str = ""


class SkillSource(Protocol):
    """Provider contract for skill discovery."""

    def discover(self) -> list[SkillEntry]:
        """Return discovered skill entries from this source."""
