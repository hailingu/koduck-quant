"""Tests for quant/skill tool execution."""

from __future__ import annotations

from pathlib import Path

import pytest

from koduck import quant_tools
from koduck.quant_tools import execute_tool


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
