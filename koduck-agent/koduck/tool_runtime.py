"""Shared runtime models for tool registry and execution metadata."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Awaitable, Callable


class ToolRiskLevel(str, Enum):
    """Risk level used by policy engine and UI."""

    SAFE = "SAFE"
    RESTRICTED = "RESTRICTED"
    DANGEROUS = "DANGEROUS"


@dataclass(frozen=True)
class ToolExecutionPolicy:
    """Execution constraints for one tool."""

    timeout_seconds: int = 20
    max_retries: int = 0
    risk_level: ToolRiskLevel = ToolRiskLevel.SAFE


@dataclass(frozen=True)
class ToolDefinition:
    """One executable tool definition registered in runtime."""

    name: str
    schema: dict[str, Any]
    description: str
    policy: ToolExecutionPolicy
    executor: Callable[[dict[str, Any]], Awaitable[str]]
