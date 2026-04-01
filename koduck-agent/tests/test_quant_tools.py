"""Tests for quant/skill tool execution."""

from __future__ import annotations

from pathlib import Path

import pytest

from koduck import quant_tools
from koduck.quant_tools import execute_tool
from koduck.skills_lock import SkillLockEntry, write_lockfile


@pytest.mark.asyncio
async def test_skill_auto_discovery_and_execution(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    skills_root = tmp_path / "skills"
    demo_skill_dir = skills_root / "demo-skill"
    scripts_dir = demo_skill_dir / "scripts"
    scripts_dir.mkdir(parents=True)

    (demo_skill_dir / "SKILL.md").write_text(
        """---
name: demo-skill
description: "Demo skill for discovery test"
---

# Demo Skill
""",
        encoding="utf-8",
    )

    (scripts_dir / "demo_tool.py").write_text(
        """import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("command")
parser.add_argument("--content")
args = parser.parse_args()
print(json.dumps({"command": args.command, "content": args.content}))
""",
        encoding="utf-8",
    )

    monkeypatch.setenv("KODUCK_SKILLS_DIRS", str(skills_root))
    quant_tools.refresh_tool_registry()

    tool_names = [tool["function"]["name"] for tool in quant_tools.QUANT_TOOL_DEFS]
    assert "run_skill_demo_skill" in tool_names

    result_raw = await execute_tool(
        "run_skill_demo_skill",
        {
            "command": "ping",
            "args": {"content": "hello"},
        },
    )
    import json

    result = json.loads(result_raw)

    assert result["ok"] is True
    assert result["status"] == 0
    assert '"command": "ping"' in result["stdout"]
    assert '"content": "hello"' in result["stdout"]

    tool_def = quant_tools.get_tool_definition("run_skill_demo_skill")
    assert tool_def is not None
    assert (tool_def.metadata or {}).get("source") == "local"


def test_builtin_tools_include_news_search() -> None:
    quant_tools.refresh_tool_registry()
    tool_names = [tool["function"]["name"] for tool in quant_tools.QUANT_TOOL_DEFS]
    assert "search_web_news" in tool_names
    assert "search_finance_news" in tool_names


@pytest.mark.asyncio
async def test_search_web_news_success(monkeypatch: pytest.MonkeyPatch) -> None:
    class DummyAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    async def fake_fetch_news_rss(client, query: str, language: str):  # noqa: ANN001
        assert query == "今日新闻"
        assert language == "zh-CN"
        return "google_news", [
            {
                "title": "示例新闻A",
                "url": "https://example.com/a",
                "published_at": "Sat, 21 Mar 2026 10:00:00 GMT",
                "source": "示例源",
            },
            {
                "title": "示例新闻B",
                "url": "https://example.com/b",
                "published_at": "Sat, 21 Mar 2026 09:00:00 GMT",
                "source": "示例源2",
            },
        ]

    monkeypatch.setattr(quant_tools.httpx, "AsyncClient", lambda *args, **kwargs: DummyAsyncClient())
    monkeypatch.setattr(quant_tools, "_fetch_news_rss", fake_fetch_news_rss)

    raw = await quant_tools.execute_tool(
        "search_web_news",
        {"query": "今日新闻", "limit": 1, "language": "zh-CN"},
    )
    import json

    result = json.loads(raw)
    assert result["ok"] is True
    assert result["provider"] == "google_news"
    assert result["count"] == 1
    assert result["items"][0]["title"] == "示例新闻A"


@pytest.mark.asyncio
async def test_search_finance_news_prefers_selected_sources(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DummyAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    async def fake_fetch_news_rss(client, query: str, language: str):  # noqa: ANN001
        assert "site:www.cls.cn" in query
        assert "site:www.yicai.com" in query
        return "google_news", [
            {
                "title": "其他来源新闻",
                "url": "https://example.com/1",
                "published_at": "Sat, 21 Mar 2026 10:00:00 GMT",
                "source": "其他",
            },
            {
                "title": "财联社快讯",
                "url": "https://www.cls.cn/detail/123",
                "published_at": "Sat, 21 Mar 2026 09:00:00 GMT",
                "source": "财联社",
            },
        ]

    monkeypatch.setattr(quant_tools.httpx, "AsyncClient", lambda *args, **kwargs: DummyAsyncClient())
    monkeypatch.setattr(quant_tools, "_fetch_news_rss", fake_fetch_news_rss)

    raw = await quant_tools.execute_tool(
        "search_finance_news",
        {"query": "今日财经新闻", "sources": ["cls", "yicai"], "limit": 1},
    )
    import json

    result = json.loads(raw)
    assert result["ok"] is True
    assert result["count"] == 1
    assert result["items"][0]["title"] == "财联社快讯"


@pytest.mark.asyncio
async def test_openclaw_skill_loaded_from_lockfile(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    script_path = tmp_path / "entry.py"
    script_path.write_text(
        """import argparse\nimport json\np = argparse.ArgumentParser(); p.add_argument('command'); args = p.parse_args(); print(json.dumps({'command': args.command}))\n""",
        encoding="utf-8",
    )
    lock_path = tmp_path / "skills.lock"
    write_lockfile(
        lock_path,
        {
            "market-news": SkillLockEntry(
                skill_id="market-news",
                source="openclaw",
                version="1.0.0",
                publisher="openclaw",
                artifact_url="https://example.com/entry.py",
                checksum="abc123",
                installed_path=str(script_path),
                installed_at="2026-03-29T00:00:00Z",
            )
        },
    )
    monkeypatch.setenv("KODUCK_SKILLS_LOCKFILE", str(lock_path))
    monkeypatch.delenv("KODUCK_SKILL_MARKET_ENABLED", raising=False)
    quant_tools.refresh_tool_registry()

    tool_names = [tool["function"]["name"] for tool in quant_tools.QUANT_TOOL_DEFS]
    assert "run_skill_market_news" in tool_names
    tool_def = quant_tools.get_tool_definition("run_skill_market_news")
    assert tool_def is not None
    assert (tool_def.metadata or {}).get("source") == "openclaw"
    assert (tool_def.metadata or {}).get("checksum") == "abc123"

    result_raw = await execute_tool(
        "run_skill_market_news",
        {"command": "ping"},
    )
    import json

    result = json.loads(result_raw)
    assert result["ok"] is True


@pytest.mark.asyncio
async def test_get_quant_signal_reads_from_db(monkeypatch: pytest.MonkeyPatch) -> None:
    bars: list[quant_tools.kline_db.KlineBar] = []
    for i in range(1, 121):
        bars.append(
            quant_tools.kline_db.KlineBar(
                timestamp=1700000000 + i * 86400,
                open=float(i),
                high=float(i) + 1.0,
                low=float(i) - 1.0,
                close=float(i),
                volume=1000.0 + i,
                amount=100000.0 + i,
            )
        )

    def fake_fetch_kline_bars(**kwargs):  # noqa: ANN003
        assert kwargs["market"] == "AShare"
        assert kwargs["symbol"] == "002326"
        assert kwargs["timeframe"] == "1D"
        return bars

    monkeypatch.setattr(quant_tools.kline_db, "fetch_kline_bars", fake_fetch_kline_bars)

    raw = await execute_tool("get_quant_signal", {"symbol": "002326"})
    import json

    result = json.loads(raw)
    assert result["ok"] is True
    assert result["symbol"] == "002326"
    assert result["signal"]["action"] in {
        "BUY_OR_HOLD",
        "REDUCE_OR_WAIT",
        "NEUTRAL_WAIT_CONFIRM",
    }


@pytest.mark.asyncio
async def test_get_quant_signal_insufficient_db_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bars = [
        quant_tools.kline_db.KlineBar(
            timestamp=1700000000 + i * 86400,
            open=10.0,
            high=11.0,
            low=9.0,
            close=10.0 + i * 0.1,
            volume=1000.0,
            amount=10000.0,
        )
        for i in range(30)
    ]
    monkeypatch.setattr(quant_tools.kline_db, "fetch_kline_bars", lambda **kwargs: bars)

    raw = await execute_tool("get_quant_signal", {"symbol": "002326"})
    import json

    result = json.loads(raw)
    assert result["ok"] is False
    assert "Insufficient kline data" in result["error"]


@pytest.mark.asyncio
async def test_get_quant_signal_db_query_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def raise_db_error(**kwargs):  # noqa: ANN003
        raise RuntimeError("db down")

    monkeypatch.setattr(quant_tools.kline_db, "fetch_kline_bars", raise_db_error)

    raw = await execute_tool("get_quant_signal", {"symbol": "002326"})
    import json

    result = json.loads(raw)
    assert result["ok"] is False
    assert "Kline database query failed" in result["error"]
