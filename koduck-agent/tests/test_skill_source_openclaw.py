"""Tests for OpenClaw market skill source discovery."""

from __future__ import annotations

from koduck.skill_source_openclaw import OpenClawSkillSource


def test_openclaw_source_discover_success(monkeypatch) -> None:
    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self):  # noqa: ANN201
            return {
                "skills": [
                    {
                        "id": "news-search",
                        "name": "news-search",
                        "description": "Market news lookup",
                        "version": "1.2.0",
                        "publisher": "openclaw",
                        "artifact_url": "https://example.com/news.py",
                    }
                ]
            }

    monkeypatch.setattr("koduck.skill_source_openclaw.httpx.get", lambda *args, **kwargs: _Resp())
    source = OpenClawSkillSource(base_url="https://market.example.com", enabled=True)
    entries = source.discover()

    assert len(entries) == 1
    assert entries[0].tool_name == "run_skill_news_search"
    assert entries[0].source == "openclaw"
    assert entries[0].version == "1.2.0"


def test_openclaw_source_discover_graceful_on_error(monkeypatch) -> None:
    def _raise(*args, **kwargs):  # noqa: ANN001, ANN202
        raise RuntimeError("network error")

    monkeypatch.setattr("koduck.skill_source_openclaw.httpx.get", _raise)
    source = OpenClawSkillSource(base_url="https://market.example.com", enabled=True)
    assert source.discover() == []
