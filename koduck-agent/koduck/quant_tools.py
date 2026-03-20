"""Quant/skill tool definitions and executors for koduck-agent."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any, Awaitable, Callable

import httpx
from koduck.tool_runtime import (
    ToolDefinition,
    ToolExecutionPolicy,
    ToolRiskLevel,
)

try:
    import yaml
except Exception:  # pragma: no cover - dependency is expected to exist in runtime
    yaml = None

logger = logging.getLogger(__name__)

DEFAULT_DATA_SERVICE_BASE = "http://data-service:8000"
DEFAULT_SKILL_TIMEOUT_SECONDS = 20

_TOOL_EXECUTORS: dict[str, Callable[[dict[str, Any]], Awaitable[str]]] = {}
QUANT_TOOL_DEFS: list[dict[str, Any]] = []
TOOL_REGISTRY: dict[str, ToolDefinition] = {}


def _backend_base_url() -> str:
    return os.getenv("DATA_SERVICE_BASE", DEFAULT_DATA_SERVICE_BASE).rstrip("/")


def _builtin_tool_defs() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_quant_signal",
                "description": "Get quant signal based on EMA20/EMA60/MACD for A-share stocks.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "symbol": {
                            "type": "string",
                            "description": "A-share symbol, usually 6 digits, e.g. 601012",
                        },
                        "market": {
                            "type": "string",
                            "description": "Market code, default AShare",
                            "default": "AShare",
                        },
                    },
                    "required": ["symbol"],
                },
            },
        },
    ]


def _normalize_skill_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return normalized or "skill"


def _skill_roots() -> list[Path]:
    env_value = os.getenv("KODUCK_SKILLS_DIRS", "").strip()
    roots: list[Path] = []

    if env_value:
        for raw in env_value.split(os.pathsep):
            candidate = Path(raw).expanduser().resolve()
            if candidate.is_dir():
                roots.append(candidate)
    else:
        # Discover .github/skills by walking up from this file and current working directory.
        candidates: list[Path] = [Path.cwd()]
        candidates.extend(Path(__file__).resolve().parents)
        for base in candidates:
            skill_root = (base / ".github" / "skills").resolve()
            if skill_root.is_dir():
                roots.append(skill_root)

    # Deduplicate while preserving order.
    deduped: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        key = str(root)
        if key not in seen:
            seen.add(key)
            deduped.append(root)
    return deduped


def _parse_skill_frontmatter(skill_md_path: Path) -> tuple[str, str]:
    skill_name = skill_md_path.parent.name
    description = "Run discovered skill command."

    try:
        raw = skill_md_path.read_text(encoding="utf-8")
    except Exception:
        return skill_name, description

    if not raw.startswith("---"):
        return skill_name, description

    lines = raw.splitlines()
    end_idx = None
    for idx, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = idx
            break

    if end_idx is None:
        return skill_name, description

    frontmatter = "\n".join(lines[1:end_idx]).strip()
    if not frontmatter:
        return skill_name, description

    if yaml is not None:
        try:
            parsed = yaml.safe_load(frontmatter) or {}
            if isinstance(parsed, dict):
                maybe_name = parsed.get("name")
                maybe_desc = parsed.get("description")
                if isinstance(maybe_name, str) and maybe_name.strip():
                    skill_name = maybe_name.strip()
                if isinstance(maybe_desc, str) and maybe_desc.strip():
                    description = maybe_desc.strip()
        except Exception:
            logger.debug("Failed to parse skill frontmatter: %s", skill_md_path)

    return skill_name, description


def _discover_skill_entries() -> list[dict[str, Any]]:
    discovered: list[dict[str, Any]] = []

    for root in _skill_roots():
        for skill_dir in sorted(root.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.is_file():
                continue

            script_candidates = sorted((skill_dir / "scripts").glob("*.py"))
            if not script_candidates:
                continue

            script_path = script_candidates[0]
            skill_name, description = _parse_skill_frontmatter(skill_md)
            tool_name = f"run_skill_{_normalize_skill_name(skill_name)}"
            discovered.append(
                {
                    "tool_name": tool_name,
                    "skill_name": skill_name,
                    "description": description,
                    "script_path": script_path,
                    "skill_md": skill_md,
                }
            )

    # Last one wins for duplicate tool names; keep deterministic behavior.
    merged: dict[str, dict[str, Any]] = {}
    for item in discovered:
        merged[item["tool_name"]] = item
    return list(merged.values())


def _skill_args_to_argv(arguments: dict[str, Any]) -> list[str]:
    argv: list[str] = []
    for raw_key, value in arguments.items():
        key = str(raw_key).strip()
        if not key:
            continue
        if not re.fullmatch(r"[A-Za-z0-9_\-]+", key):
            continue

        flag = f"--{key.replace('_', '-')}"

        if isinstance(value, bool):
            if value:
                argv.append(flag)
            continue

        if value is None:
            continue

        if isinstance(value, (list, tuple)):
            for item in value:
                argv.extend([flag, str(item)])
            continue

        if isinstance(value, dict):
            argv.extend([flag, json.dumps(value, ensure_ascii=False)])
            continue

        argv.extend([flag, str(value)])

    return argv


async def _execute_discovered_skill(
    *,
    tool_name: str,
    skill_name: str,
    script_path: Path,
    arguments: dict[str, Any],
) -> str:
    command = str(arguments.get("command", "")).strip()
    if not command:
        return json.dumps(
            {
                "ok": False,
                "tool": tool_name,
                "skill": skill_name,
                "error": "Missing required argument: command",
            },
            ensure_ascii=False,
        )

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", command):
        return json.dumps(
            {
                "ok": False,
                "tool": tool_name,
                "skill": skill_name,
                "error": "Invalid command format",
            },
            ensure_ascii=False,
        )

    args_obj = arguments.get("args")
    if args_obj is None:
        args_obj = {}
    if not isinstance(args_obj, dict):
        return json.dumps(
            {
                "ok": False,
                "tool": tool_name,
                "skill": skill_name,
                "error": "Argument 'args' must be an object",
            },
            ensure_ascii=False,
        )

    argv = [sys.executable, str(script_path), command, *_skill_args_to_argv(args_obj)]

    timeout_seconds = int(
        os.getenv("KODUCK_SKILL_TIMEOUT_SECONDS", str(DEFAULT_SKILL_TIMEOUT_SECONDS))
    )

    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        if "proc" in locals() and proc.returncode is None:
            proc.kill()
            await proc.wait()
        return json.dumps(
            {
                "ok": False,
                "tool": tool_name,
                "skill": skill_name,
                "error": f"Skill command timed out after {timeout_seconds}s",
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.warning("Skill command execution failed: tool=%s error=%s", tool_name, e)
        return json.dumps(
            {
                "ok": False,
                "tool": tool_name,
                "skill": skill_name,
                "error": f"Skill command execution failed: {e}",
            },
            ensure_ascii=False,
        )

    stdout_text = stdout.decode("utf-8", errors="replace") if stdout else ""
    stderr_text = stderr.decode("utf-8", errors="replace") if stderr else ""

    result = {
        "ok": proc.returncode == 0,
        "tool": tool_name,
        "skill": skill_name,
        "command": command,
        "status": proc.returncode,
        "stdout": stdout_text[:4000],
        "stderr": stderr_text[:2000],
    }
    if proc.returncode != 0:
        result["error"] = "Skill command returned non-zero exit code"
    return json.dumps(result, ensure_ascii=False)


def refresh_tool_registry() -> None:
    """Rebuild tool defs/executors from builtin tools plus discovered skills."""
    QUANT_TOOL_DEFS.clear()
    _TOOL_EXECUTORS.clear()
    TOOL_REGISTRY.clear()

    for tool_def in _builtin_tool_defs():
        name = str(tool_def["function"]["name"])
        QUANT_TOOL_DEFS.append(tool_def)
        if name == "get_quant_signal":
            _TOOL_EXECUTORS[name] = _get_quant_signal
            TOOL_REGISTRY[name] = ToolDefinition(
                name=name,
                schema=tool_def,
                description=str(tool_def["function"]["description"]),
                policy=ToolExecutionPolicy(
                    timeout_seconds=10,
                    max_retries=1,
                    risk_level=ToolRiskLevel.SAFE,
                ),
                executor=_get_quant_signal,
            )

    discovered_entries = _discover_skill_entries()
    for entry in discovered_entries:
        tool_name = entry["tool_name"]
        skill_name = entry["skill_name"]
        description = entry["description"]
        script_path = Path(entry["script_path"])

        QUANT_TOOL_DEFS.append(
            {
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": (
                        f"[{skill_name}] {description} "
                        f"Use 'command' and optional 'args' to run its CLI command."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "command": {
                                "type": "string",
                                "description": "Skill CLI command name.",
                            },
                            "args": {
                                "type": "object",
                                "description": "Optional CLI flag map, converted to --kebab-case flags.",
                            },
                        },
                        "required": ["command"],
                    },
                },
            }
        )

        async def _executor(args: dict[str, Any], *, _tool_name=tool_name, _skill_name=skill_name, _script_path=script_path) -> str:
            return await _execute_discovered_skill(
                tool_name=_tool_name,
                skill_name=_skill_name,
                script_path=_script_path,
                arguments=args,
            )

        _TOOL_EXECUTORS[tool_name] = _executor
        TOOL_REGISTRY[tool_name] = ToolDefinition(
            name=tool_name,
            schema=QUANT_TOOL_DEFS[-1],
            description=str(QUANT_TOOL_DEFS[-1]["function"]["description"]),
            policy=ToolExecutionPolicy(
                timeout_seconds=DEFAULT_SKILL_TIMEOUT_SECONDS,
                max_retries=0,
                risk_level=ToolRiskLevel.RESTRICTED,
            ),
            executor=_executor,
        )

    logger.info(
        "Tool registry refreshed: builtin=%s discovered_skills=%s total=%s",
        len(_builtin_tool_defs()),
        len(discovered_entries),
        len(QUANT_TOOL_DEFS),
    )


async def execute_tool(name: str, arguments: dict[str, Any]) -> str:
    """Execute one supported tool and return JSON string content."""
    executor = _TOOL_EXECUTORS.get(name)
    if executor is None:
        return json.dumps(
            {
                "ok": False,
                "error": f"Unsupported tool: {name}",
                "available_tools": sorted(_TOOL_EXECUTORS.keys()),
            },
            ensure_ascii=False,
        )
    return await executor(arguments)


def get_tool_definitions() -> list[ToolDefinition]:
    """List all registered tool definitions."""
    return list(TOOL_REGISTRY.values())


def get_tool_definition(name: str) -> ToolDefinition | None:
    """Get one registered tool definition."""
    return TOOL_REGISTRY.get(name)


def list_discovered_skills() -> list[dict[str, Any]]:
    """Return discovered skills for API/console usage."""
    skills: list[dict[str, Any]] = []
    for tool in get_tool_definitions():
        if not tool.name.startswith("run_skill_"):
            continue
        skill_name = tool.name.removeprefix("run_skill_")
        skills.append(
            {
                "tool_name": tool.name,
                "skill_name": skill_name,
                "description": tool.description,
                "risk_level": tool.policy.risk_level.value,
            }
        )
    return skills


async def run_skill_command(skill_name: str, command: str, args: dict[str, Any] | None = None) -> str:
    """Execute one discovered skill by logical skill name."""
    normalized = _normalize_skill_name(skill_name)
    tool_name = f"run_skill_{normalized}"
    return await execute_tool(
        tool_name,
        {
            "command": command,
            "args": args or {},
        },
    )


async def _get_quant_signal(arguments: dict[str, Any]) -> str:
    symbol = str(arguments.get("symbol", "")).strip()
    market = str(arguments.get("market", "AShare")).strip() or "AShare"

    if not symbol:
        return json.dumps(
            {"ok": False, "error": "Missing required argument: symbol"},
            ensure_ascii=False,
        )

    base = _backend_base_url()
    timeout = httpx.Timeout(10.0, connect=5.0)
    endpoint = f"{base}/api/v1/a-share/kline"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                endpoint,
                params={
                    "symbol": symbol,
                    "timeframe": "1D",
                    "limit": 260,
                },
            )
    except Exception as e:
        logger.warning("quant tool request failed: %s", e)
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": f"Data service request failed: {e}"},
            ensure_ascii=False,
        )

    if resp.status_code != 200:
        return json.dumps(
            {
                "ok": False,
                "symbol": symbol,
                "error": f"Kline API failed: status={resp.status_code}",
            },
            ensure_ascii=False,
        )

    closes = _extract_close_prices(resp.json())
    if len(closes) < 60:
        return json.dumps(
            {
                "ok": False,
                "symbol": symbol,
                "error": f"Insufficient kline data: {len(closes)} points",
            },
            ensure_ascii=False,
        )

    ema20 = _ema(closes, 20)
    ema60 = _ema(closes, 60)
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    if None in (ema12, ema26):
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": "Failed to compute MACD base values"},
            ensure_ascii=False,
        )
    macd_series = _macd_series(closes)
    if len(macd_series) < 9:
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": "Insufficient MACD series"},
            ensure_ascii=False,
        )
    signal = _ema(macd_series, 9)
    macd = ema12 - ema26
    hist = macd - signal if signal is not None else None

    if None in (ema20, ema60, macd, signal, hist):
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": "Incomplete indicator values"},
            ensure_ascii=False,
        )

    direction = "LONG_BIAS" if float(ema20) >= float(ema60) else "SHORT_BIAS"
    momentum = "MOMENTUM_UP" if float(hist) >= 0 else "MOMENTUM_DOWN"
    if direction == "LONG_BIAS" and momentum == "MOMENTUM_UP":
        action = "BUY_OR_HOLD"
    elif direction == "SHORT_BIAS" and momentum == "MOMENTUM_DOWN":
        action = "REDUCE_OR_WAIT"
    else:
        action = "NEUTRAL_WAIT_CONFIRM"

    return json.dumps(
        {
            "ok": True,
            "symbol": symbol,
            "market": market,
            "indicators": {
                "ema20": round(float(ema20), 4),
                "ema60": round(float(ema60), 4),
                "macd": round(float(macd), 4),
                "signal": round(float(signal), 4),
                "histogram": round(float(hist), 4),
            },
            "signal": {
                "direction": direction,
                "momentum": momentum,
                "action": action,
            },
            "note": "Quant signal is for reference only, not financial advice.",
        },
        ensure_ascii=False,
    )


def _extract_close_prices(payload: dict[str, Any]) -> list[float]:
    # Data-service response shape: {"code":0,"message":"success","data":[{...}]}
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return []
    closes: list[float] = []
    for item in data:
        if isinstance(item, dict) and item.get("close") is not None:
            try:
                closes.append(float(item["close"]))
            except Exception:
                continue
    return closes


def _ema(values: list[float], period: int) -> float | None:
    if period <= 0 or len(values) < period:
        return None
    alpha = 2.0 / (period + 1.0)
    ema_value = sum(values[:period]) / period
    for price in values[period:]:
        ema_value = alpha * price + (1 - alpha) * ema_value
    return ema_value


def _macd_series(closes: list[float]) -> list[float]:
    if len(closes) < 26:
        return []
    ema12 = sum(closes[:12]) / 12.0
    ema26 = sum(closes[:26]) / 26.0
    alpha12 = 2.0 / 13.0
    alpha26 = 2.0 / 27.0
    series: list[float] = []
    for i, price in enumerate(closes):
        if i >= 12:
            ema12 = alpha12 * price + (1 - alpha12) * ema12
        if i >= 26:
            ema26 = alpha26 * price + (1 - alpha26) * ema26
            series.append(ema12 - ema26)
    return series


refresh_tool_registry()
