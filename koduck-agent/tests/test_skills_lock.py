"""Tests for skill lockfile helpers."""

from __future__ import annotations

from pathlib import Path

from koduck.skills_lock import SkillLockEntry, read_lockfile, remove_lock_entry, upsert_lock_entry


def test_lockfile_upsert_and_read(tmp_path: Path) -> None:
    lockfile = tmp_path / "skills.lock"
    entry = SkillLockEntry(
        skill_id="news-search",
        source="openclaw",
        version="1.0.0",
        publisher="openclaw",
        artifact_url="https://example.com/news.py",
        checksum="abc",
        installed_path="/tmp/entry.py",
        installed_at="2026-01-01T00:00:00Z",
    )

    upsert_lock_entry(lockfile, entry)
    parsed = read_lockfile(lockfile)

    assert "news-search" in parsed
    assert parsed["news-search"].version == "1.0.0"
    assert parsed["news-search"].source == "openclaw"


def test_lockfile_remove_entry(tmp_path: Path) -> None:
    lockfile = tmp_path / "skills.lock"
    entry = SkillLockEntry(
        skill_id="news-search",
        source="openclaw",
        version="1.0.0",
    )
    upsert_lock_entry(lockfile, entry)
    removed = remove_lock_entry(lockfile, "news-search")
    assert "news-search" not in removed
