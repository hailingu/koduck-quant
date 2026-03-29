"""Tests for script skill installer."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from koduck.skill_installer import SkillInstaller
from koduck.skills_lock import read_lockfile


def test_install_script_skill_success(monkeypatch, tmp_path: Path) -> None:
    payload = b"print('hello from market skill')\n"

    class _Resp:
        content = payload

        def raise_for_status(self) -> None:
            return None

    monkeypatch.setattr("koduck.skill_installer.httpx.get", lambda *args, **kwargs: _Resp())

    installer = SkillInstaller(
        cache_root=tmp_path / ".skill-cache",
        lockfile_path=tmp_path / "skills.lock",
    )
    script_path = installer.install_script_skill(
        skill_id="news-search",
        source="openclaw",
        version="1.0.0",
        artifact_url="https://example.com/news.py",
    )

    assert script_path.exists()
    assert script_path.read_bytes() == payload
    lock_entries = read_lockfile(tmp_path / "skills.lock")
    assert lock_entries["news-search"].installed_path == str(script_path)


def test_install_script_skill_checksum_mismatch(monkeypatch, tmp_path: Path) -> None:
    payload = b"print('bad')\n"

    class _Resp:
        content = payload

        def raise_for_status(self) -> None:
            return None

    monkeypatch.setattr("koduck.skill_installer.httpx.get", lambda *args, **kwargs: _Resp())

    installer = SkillInstaller(
        cache_root=tmp_path / ".skill-cache",
        lockfile_path=tmp_path / "skills.lock",
    )
    expected = hashlib.sha256(b"something-else").hexdigest()
    with pytest.raises(ValueError, match="checksum mismatch"):
        installer.install_script_skill(
            skill_id="news-search",
            source="openclaw",
            version="1.0.0",
            artifact_url="https://example.com/news.py",
            expected_checksum=expected,
        )


def test_uninstall_skill_removes_lock_entry(monkeypatch, tmp_path: Path) -> None:
    payload = b"print('hello')\n"

    class _Resp:
        content = payload

        def raise_for_status(self) -> None:
            return None

    monkeypatch.setattr("koduck.skill_installer.httpx.get", lambda *args, **kwargs: _Resp())
    installer = SkillInstaller(
        cache_root=tmp_path / ".skill-cache",
        lockfile_path=tmp_path / "skills.lock",
    )
    script_path = installer.install_script_skill(
        skill_id="news-search",
        source="openclaw",
        version="1.0.0",
        artifact_url="https://example.com/news.py",
    )
    assert script_path.exists()
    installer.uninstall_skill("news-search")
    lock_entries = read_lockfile(tmp_path / "skills.lock")
    assert "news-search" not in lock_entries
