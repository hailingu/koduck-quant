"""Domain models for skills and their provenance metadata."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from koduck.tool_runtime import ToolRiskLevel


class SkillSource(str, Enum):
    """Supported skill source types."""

    LOCAL = "local"
    OPENCLAW = "openclaw"


@dataclass(frozen=True)
class SkillEntrypoint:
    """Executable entrypoint for one skill."""

    script_path: str
    command_schema: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SkillProvenance:
    """Supply-chain metadata for a skill artifact."""

    source: SkillSource
    publisher: str = ""
    version: str = ""
    checksum: str = ""
    signature: str = ""


@dataclass(frozen=True)
class SkillManifest:
    """Normalized manifest used by Koduck runtime."""

    skill_id: str
    display_name: str
    description: str
    entrypoint: SkillEntrypoint
    risk_level: ToolRiskLevel = ToolRiskLevel.RESTRICTED
    provenance: SkillProvenance = field(
        default_factory=lambda: SkillProvenance(source=SkillSource.LOCAL)
    )
