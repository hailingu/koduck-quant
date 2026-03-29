"""Quant/skill tool definitions and executors for koduck-agent."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Awaitable, Callable

import httpx
from koduck import kline_db
from koduck.skill_source import SkillEntry
from koduck.skill_source_openclaw import OpenClawSkillSource
from koduck.skill_source_local import LocalSkillSource
from koduck.skills_lock import read_lockfile
from koduck.tool_runtime import ToolDefinition, ToolExecutionPolicy, ToolRiskLevel
from koduck.tool_registry import registry as TOOL_REGISTRY

logger = logging.getLogger(__name__)

DEFAULT_SKILL_TIMEOUT_SECONDS = 20

_TOOL_EXECUTORS: dict[str, Callable[[dict[str, Any]], Awaitable[str]]] = {}
QUANT_TOOL_DEFS: list[dict[str, Any]] = []


def _register_tool_definition(
    *,
    name: str,
    schema: dict[str, Any],
    description: str,
    policy: ToolExecutionPolicy,
    executor: Callable[[dict[str, Any]], Awaitable[str]],
    metadata: dict[str, Any] | None = None,
) -> None:
    _TOOL_EXECUTORS[name] = executor
    TOOL_REGISTRY.register(
        ToolDefinition(
            name=name,
            schema=schema,
            description=description,
            policy=policy,
            executor=executor,
            metadata=metadata or {},
        )
    )


def get_tool_definition(name: str) -> ToolDefinition | None:
    return TOOL_REGISTRY.get(name)


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
        {
            "type": "function",
            "function": {
                "name": "search_web_news",
                "description": (
                    "Search latest web news for a topic. "
                    "Useful for requests about today's news, latest events, or real-time updates."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "News topic or keywords, e.g. 今日新闻, AI, 美股.",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Max number of returned items (1-10).",
                            "default": 5,
                        },
                        "language": {
                            "type": "string",
                            "description": "Language code (zh-CN / en-US). Default zh-CN.",
                            "default": "zh-CN",
                        },
                    },
                    "required": ["query"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_finance_news",
                "description": (
                    "Search latest finance news with source preference. "
                    "To maximize coverage, make MULTIPLE parallel calls: "
                    "- Call 1: Chinese keywords + sources=[\"cls\", \"yicai\"] "
                    "- Call 2: English keywords + sources=[\"bloomberg\", \"reuters\", \"cnbc\", ...] "
                    "Chinese sources (cls=财联社, yicai=第一财经) need Chinese query. "
                    "English sources (bloomberg, reuters, ft, wsj, cnbc) need English query."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Finance topic keywords, e.g. 今日A股新闻, 美联储, 科技股.",
                        },
                        "sources": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "cls", "yicai",
                                    "bloomberg", "reuters", "ft", "wsj", "cnbc",
                                    "marketwatch", "investing", "seekingalpha"
                                ]
                            },
                            "description": (
                                "Preferred finance sources. "
                                "Chinese: cls=财联社, yicai=第一财经. "
                                "US/EU: bloomberg=Bloomberg, reuters=Reuters, ft=Financial Times, "
                                "wsj=Wall Street Journal, cnbc=CNBC, marketwatch=MarketWatch, "
                                "investing=Investing.com, seekingalpha=Seeking Alpha."
                            ),
                            "default": ["cls", "yicai"],
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Max number of returned items (1-10).",
                            "default": 5,
                        },
                        "language": {
                            "type": "string",
                            "description": "Language code (zh-CN / en-US). Default zh-CN.",
                            "default": "zh-CN",
                        },
                    },
                    "required": ["query"],
                },
            },
        },
    ]


def _discover_skill_entries() -> list[dict[str, Any]]:
    discovered = LocalSkillSource().discover()
    discovered.extend(_discover_openclaw_skill_entries())
    return [
        {
            "tool_name": item.tool_name,
            "skill_name": item.skill_name,
            "description": item.description,
            "script_path": item.script_path,
            "skill_md": item.skill_md,
            "source": item.source,
            "version": item.version,
            "publisher": item.publisher,
            "artifact_url": item.artifact_url,
            "checksum": item.checksum,
        }
        for item in discovered
    ]


def _agent_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _default_skills_lockfile() -> Path:
    return (_agent_root() / "skills.lock").resolve()


def _discover_openclaw_skill_entries() -> list[Any]:
    lockfile_path = Path(
        os.getenv("KODUCK_SKILLS_LOCKFILE", str(_default_skills_lockfile()))
    ).resolve()
    lock_entries = read_lockfile(lockfile_path)
    if not lock_entries:
        return []

    market_index = {
        item.skill_name: item for item in OpenClawSkillSource().discover()
    }
    installed_entries: list[Any] = []
    for lock in lock_entries.values():
        if lock.source != "openclaw":
            continue
        script_path = Path(lock.installed_path)
        if not script_path.is_file():
            logger.warning(
                "OpenClaw skill missing installed file: skill=%s path=%s",
                lock.skill_id,
                script_path,
            )
            continue
        market_entry = market_index.get(lock.skill_id)
        description = (
            market_entry.description if market_entry is not None else "OpenClaw market skill"
        )
        tool_name = (
            market_entry.tool_name
            if market_entry is not None
            else f"run_skill_{re.sub(r'[^a-z0-9]+', '_', lock.skill_id.lower()).strip('_')}"
        )
        skill_md = (
            market_entry.skill_md
            if market_entry is not None
            else Path(f"/tmp/openclaw-market/{lock.skill_id}/SKILL.md")
        )
        installed_entries.append(
            SkillEntry(
                tool_name=tool_name,
                skill_name=lock.skill_id,
                description=description,
                script_path=script_path,
                skill_md=skill_md,
                source="openclaw",
                version=lock.version,
                publisher=lock.publisher,
                artifact_url=lock.artifact_url,
                checksum=lock.checksum,
            )
        )
    return installed_entries


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
            _register_tool_definition(
                name=name,
                schema=tool_def["function"].get("parameters", {}),
                description=tool_def["function"].get("description", ""),
                policy=ToolExecutionPolicy(risk_level=ToolRiskLevel.SAFE),
                executor=_get_quant_signal,
                metadata={"source": "builtin", "version": "", "publisher": ""},
            )
        elif name == "search_web_news":
            _register_tool_definition(
                name=name,
                schema=tool_def["function"].get("parameters", {}),
                description=tool_def["function"].get("description", ""),
                policy=ToolExecutionPolicy(risk_level=ToolRiskLevel.SAFE),
                executor=_search_web_news,
                metadata={"source": "builtin", "version": "", "publisher": ""},
            )
        elif name == "search_finance_news":
            _register_tool_definition(
                name=name,
                schema=tool_def["function"].get("parameters", {}),
                description=tool_def["function"].get("description", ""),
                policy=ToolExecutionPolicy(risk_level=ToolRiskLevel.SAFE),
                executor=_search_finance_news,
                metadata={"source": "builtin", "version": "", "publisher": ""},
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

        _register_tool_definition(
            name=tool_name,
            schema={
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                    "args": {"type": "object"},
                },
                "required": ["command"],
            },
            description=description,
            policy=ToolExecutionPolicy(risk_level=ToolRiskLevel.RESTRICTED),
            executor=_executor,
            metadata={
                "source": entry.get("source", "local"),
                "version": entry.get("version", ""),
                "publisher": entry.get("publisher", ""),
                "artifact_url": entry.get("artifact_url", ""),
                "checksum": entry.get("checksum", ""),
            },
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


async def _get_quant_signal(arguments: dict[str, Any]) -> str:
    symbol = str(arguments.get("symbol", "")).strip()
    market = str(arguments.get("market", "AShare")).strip() or "AShare"

    if not symbol:
        return json.dumps(
            {"ok": False, "error": "Missing required argument: symbol"},
            ensure_ascii=False,
        )

    normalized_symbol = kline_db.normalize_symbol(symbol)
    try:
        bars = await asyncio.to_thread(
            kline_db.fetch_kline_bars,
            market=market,
            symbol=normalized_symbol,
            timeframe="1D",
            limit=260,
        )
    except Exception as e:
        logger.warning("quant db query failed: %s", e)
        return json.dumps(
            {
                "ok": False,
                "symbol": normalized_symbol or symbol,
                "error": f"Kline database query failed: {e}",
            },
            ensure_ascii=False,
        )

    closes = [bar.close for bar in bars]
    if len(closes) < 60:
        return json.dumps(
            {
                "ok": False,
                "symbol": normalized_symbol or symbol,
                "error": f"Insufficient kline data: {len(closes)} points",
            },
            ensure_ascii=False,
        )

    ema20 = _ema(closes, 20)
    ema60 = _ema(closes, 60)
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    if ema12 is None or ema26 is None:
        return json.dumps(
            {
                "ok": False,
                "symbol": normalized_symbol or symbol,
                "error": "Failed to compute MACD base values",
            },
            ensure_ascii=False,
        )
    macd_series = _macd_series(closes)
    if len(macd_series) < 9:
        return json.dumps(
            {
                "ok": False,
                "symbol": normalized_symbol or symbol,
                "error": "Insufficient MACD series",
            },
            ensure_ascii=False,
        )
    signal = _ema(macd_series, 9)
    macd = ema12 - ema26

    if ema20 is None or ema60 is None or signal is None:
        return json.dumps(
            {
                "ok": False,
                "symbol": normalized_symbol or symbol,
                "error": "Incomplete indicator values",
            },
            ensure_ascii=False,
        )

    hist = macd - signal

    direction = "LONG_BIAS" if ema20 >= ema60 else "SHORT_BIAS"
    momentum = "MOMENTUM_UP" if hist >= 0 else "MOMENTUM_DOWN"
    if direction == "LONG_BIAS" and momentum == "MOMENTUM_UP":
        action = "BUY_OR_HOLD"
    elif direction == "SHORT_BIAS" and momentum == "MOMENTUM_DOWN":
        action = "REDUCE_OR_WAIT"
    else:
        action = "NEUTRAL_WAIT_CONFIRM"

    return json.dumps(
        {
            "ok": True,
            "symbol": normalized_symbol or symbol,
            "market": market,
            "indicators": {
                "ema20": round(ema20, 4),
                "ema60": round(ema60, 4),
                "macd": round(macd, 4),
                "signal": round(signal, 4),
                "histogram": round(hist, 4),
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


def _clip_int(raw: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(raw)
    except Exception:
        value = default
    return max(minimum, min(maximum, value))


def _parse_rss_items(xml_text: str, limit: int) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return items

    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source = ""
        source_node = item.find("source")
        if source_node is not None and source_node.text:
            source = source_node.text.strip()
        if not source and title:
            # Common RSS title format: "Title - SourceName"
            if " - " in title:
                source = title.rsplit(" - ", 1)[-1].strip()

        if not title and not link:
            continue
        items.append(
            {
                "title": title,
                "url": link,
                "published_at": pub_date,
                "source": source,
            }
        )
        if len(items) >= limit:
            break
    return items


async def _fetch_news_rss(client: httpx.AsyncClient, query: str, language: str) -> tuple[str, list[dict[str, str]]]:
    lang = "zh-CN" if language.lower().startswith("zh") else "en-US"
    hl = "zh-CN" if lang == "zh-CN" else "en-US"
    gl = "CN" if lang == "zh-CN" else "US"
    ceid = f"{gl}:{hl}"
    encoded_query = urllib.parse.quote_plus(query)

    providers = [
        (
            "google_news",
            f"https://news.google.com/rss/search?q={encoded_query}&hl={hl}&gl={gl}&ceid={ceid}",
        ),
        (
            "bing_news",
            f"https://www.bing.com/news/search?q={encoded_query}&format=rss&setlang={hl}",
        ),
    ]

    for provider, url in providers:
        try:
            resp = await client.get(url)
        except Exception as e:
            logger.warning("news search request failed: provider=%s error=%s", provider, e)
            continue
        if resp.status_code != 200 or not resp.text:
            logger.warning(
                "news search non-200: provider=%s status=%s",
                provider,
                resp.status_code,
            )
            continue
        return provider, _parse_rss_items(resp.text, limit=10)

    return "", []


async def _search_web_news(arguments: dict[str, Any]) -> str:
    query = str(arguments.get("query", "")).strip()
    if not query:
        return json.dumps(
            {"ok": False, "error": "Missing required argument: query"},
            ensure_ascii=False,
        )

    limit = _clip_int(arguments.get("limit", 5), default=5, minimum=1, maximum=10)
    language = str(arguments.get("language", "zh-CN")).strip() or "zh-CN"
    timeout = httpx.Timeout(10.0, connect=5.0)
    headers = {"User-Agent": "koduck-agent/0.1 (+https://koduck.local)"}

    provider = ""
    items: list[dict[str, str]] = []
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            provider, parsed_items = await _fetch_news_rss(client, query=query, language=language)
            items = parsed_items[:limit]
    except Exception as e:
        logger.warning("search_web_news failed: %s", e)
        return json.dumps(
            {"ok": False, "query": query, "error": f"News search request failed: {e}"},
            ensure_ascii=False,
        )

    if not items:
        return json.dumps(
            {
                "ok": False,
                "query": query,
                "error": "No news results found from available RSS providers",
            },
            ensure_ascii=False,
        )

    return json.dumps(
        {
            "ok": True,
            "query": query,
            "language": language,
            "provider": provider,
            "count": len(items),
            "items": items,
            "note": "Results are from public news RSS feeds and may include redirects.",
        },
        ensure_ascii=False,
    )


# Supported finance sources mapping
_FINANCE_SOURCES = {
    # Chinese
    "cls": "cls",
    "yicai": "yicai",
    # US/EU
    "bloomberg": "bloomberg",
    "reuters": "reuters",
    "ft": "ft",
    "wsj": "wsj",
    "cnbc": "cnbc",
    "marketwatch": "marketwatch",
    "investing": "investing",
    "seekingalpha": "seekingalpha",
}


def _normalize_finance_sources(raw_sources: Any) -> list[str]:
    if not raw_sources:
        return ["cls", "yicai"]
    if isinstance(raw_sources, str):
        candidates = [raw_sources]
    elif isinstance(raw_sources, list):
        candidates = [str(x) for x in raw_sources]
    else:
        return ["cls", "yicai"]

    cleaned: list[str] = []
    for candidate in candidates:
        key = candidate.strip().lower()
        if key in _FINANCE_SOURCES and key not in cleaned:
            cleaned.append(key)
    return cleaned or ["cls", "yicai"]


def _domain_for_source(source: str) -> str:
    """Map source code to domain for site-scoped search."""
    domains = {
        # Chinese
        "cls": "www.cls.cn",
        "yicai": "www.yicai.com",
        # US/EU
        "bloomberg": "www.bloomberg.com",
        "reuters": "www.reuters.com",
        "ft": "www.ft.com",
        "wsj": "www.wsj.com",
        "cnbc": "www.cnbc.com",
        "marketwatch": "www.marketwatch.com",
        "investing": "www.investing.com",
        "seekingalpha": "seekingalpha.com",
    }
    return domains.get(source, "")


def _infer_source_by_url(url: str) -> str:
    """Infer source code from URL hostname."""
    try:
        host = (urllib.parse.urlparse(url).hostname or "").lower()
    except Exception:
        host = ""
    # Chinese sources
    if "cls.cn" in host:
        return "cls"
    if "yicai.com" in host:
        return "yicai"
    # US/EU sources
    if "bloomberg.com" in host:
        return "bloomberg"
    if "reuters.com" in host:
        return "reuters"
    if "ft.com" in host:
        return "ft"
    if "wsj.com" in host:
        return "wsj"
    if "cnbc.com" in host:
        return "cnbc"
    if "marketwatch.com" in host:
        return "marketwatch"
    if "investing.com" in host:
        return "investing"
    if "seekingalpha.com" in host:
        return "seekingalpha"
    return ""


async def _search_finance_news(arguments: dict[str, Any]) -> str:
    query = str(arguments.get("query", "")).strip()
    if not query:
        return json.dumps(
            {"ok": False, "error": "Missing required argument: query"},
            ensure_ascii=False,
        )

    limit = _clip_int(arguments.get("limit", 5), default=5, minimum=1, maximum=10)
    language = str(arguments.get("language", "zh-CN")).strip() or "zh-CN"
    sources = _normalize_finance_sources(arguments.get("sources"))
    timeout = httpx.Timeout(10.0, connect=5.0)
    headers = {"User-Agent": "koduck-agent/0.1 (+https://koduck.local)"}

    # Use site-scoped news search for finance sources.
    # Example query: "今日新闻 site:www.cls.cn OR site:www.yicai.com"
    site_query_parts = [f"site:{_domain_for_source(s)}" for s in sources if _domain_for_source(s)]
    scoped_query = query
    if site_query_parts:
        scoped_query = f"{query} " + " OR ".join(site_query_parts)

    provider = ""
    items: list[dict[str, str]] = []
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            provider, parsed_items = await _fetch_news_rss(
                client,
                query=scoped_query,
                language=language,
            )
            for item in parsed_items:
                detected_source = _infer_source_by_url(item.get("url", ""))
                if detected_source:
                    item["source_code"] = detected_source
                if not detected_source and item.get("source"):
                    lowered = item["source"].lower()
                    # Chinese sources
                    if "财联社" in item["source"] or "cls" in lowered:
                        item["source_code"] = "cls"
                    elif "第一财经" in item["source"] or "yicai" in lowered:
                        item["source_code"] = "yicai"
                    # US/EU sources
                    elif "bloomberg" in lowered:
                        item["source_code"] = "bloomberg"
                    elif "reuters" in lowered:
                        item["source_code"] = "reuters"
                    elif "financial times" in lowered or "ft.com" in lowered:
                        item["source_code"] = "ft"
                    elif "wall street journal" in lowered or "wsj" in lowered:
                        item["source_code"] = "wsj"
                    elif "cnbc" in lowered:
                        item["source_code"] = "cnbc"
                    elif "marketwatch" in lowered:
                        item["source_code"] = "marketwatch"
                    elif "investing.com" in lowered:
                        item["source_code"] = "investing"
                    elif "seeking alpha" in lowered or "seekingalpha" in lowered:
                        item["source_code"] = "seekingalpha"
            # If source filtering is requested, keep matching items first.
            preferred = [i for i in parsed_items if i.get("source_code") in sources]
            fallback = [i for i in parsed_items if i.get("source_code") not in sources]
            items = (preferred + fallback)[:limit]
    except Exception as e:
        logger.warning("search_finance_news failed: %s", e)
        return json.dumps(
            {
                "ok": False,
                "query": query,
                "sources": sources,
                "error": f"Finance news search request failed: {e}",
            },
            ensure_ascii=False,
        )

    if not items:
        return json.dumps(
            {
                "ok": False,
                "query": query,
                "sources": sources,
                "error": "No finance news results found from preferred sources",
            },
            ensure_ascii=False,
        )

    return json.dumps(
        {
            "ok": True,
            "query": query,
            "scoped_query": scoped_query,
            "sources": sources,
            "language": language,
            "provider": provider,
            "count": len(items),
            "items": items,
            "note": "Results are ranked with preferred finance sources first.",
        },
        ensure_ascii=False,
    )


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
