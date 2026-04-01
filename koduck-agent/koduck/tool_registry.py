"""In-memory registry for executable tools."""

from __future__ import annotations

from typing import Iterable

from koduck.tool_runtime import ToolDefinition


class ToolRegistry:
    """Simple runtime registry for tool metadata and executors."""

    def __init__(self) -> None:
        self._definitions: dict[str, ToolDefinition] = {}

    def clear(self) -> None:
        self._definitions.clear()

    def register(self, definition: ToolDefinition) -> None:
        self._definitions[definition.name] = definition

    def get(self, name: str) -> ToolDefinition | None:
        return self._definitions.get(name)

    def list_names(self) -> list[str]:
        return sorted(self._definitions.keys())

    def values(self) -> Iterable[ToolDefinition]:
        return self._definitions.values()


registry = ToolRegistry()
