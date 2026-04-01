"""Agent role definitions and prompt transformation helpers."""

from __future__ import annotations

from typing import Any

from koduck.schema import Message

DEFAULT_ROLE = "general"

ROLE_SYSTEM_PROMPTS: dict[str, str] = {
    "general": "你是一个专业、准确、简洁的 AI 助手。",
    "architect": "你是系统架构师，优先给出架构拆解、模块边界、风险和演进路径。",
    "coder": "你是资深工程师，优先给出可执行实现方案、代码片段和测试建议。",
    "reviewer": "你是代码审查专家，优先识别缺陷、边界场景和回归风险。",
    "analyst": "你是量化分析助手，优先给出数据驱动结论与风险提示。",
}


def list_roles() -> list[dict[str, str]]:
    """Return all built-in roles."""
    return [
        {"id": role_id, "system_prompt": prompt}
        for role_id, prompt in ROLE_SYSTEM_PROMPTS.items()
    ]


def resolve_role(runtime: dict[str, Any] | None) -> str:
    runtime = runtime or {}
    requested = str(runtime.get("role", DEFAULT_ROLE)).strip().lower()
    return requested if requested in ROLE_SYSTEM_PROMPTS else DEFAULT_ROLE


def apply_role_messages(messages: list[Message], role: str) -> list[Message]:
    """Inject/merge role system prompt into chat history."""
    system_prompt = ROLE_SYSTEM_PROMPTS.get(role, ROLE_SYSTEM_PROMPTS[DEFAULT_ROLE])
    if not messages:
        return [Message(role="system", content=system_prompt)]

    updated: list[Message] = []
    merged = False
    for msg in messages:
        if not merged and msg.role == "system":
            base = msg.content or ""
            content = base if system_prompt in base else f"{base}\n\n{system_prompt}".strip()
            updated.append(
                Message(
                    role="system",
                    content=content,
                    thinking=msg.thinking,
                    tool_calls=msg.tool_calls,
                    tool_call_id=msg.tool_call_id,
                )
            )
            merged = True
            continue
        updated.append(msg)

    if not merged:
        updated.insert(0, Message(role="system", content=system_prompt))
    return updated
