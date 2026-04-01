"""Skill installer for market-provided script artifacts."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

import httpx

from koduck.skills_lock import SkillLockEntry, read_lockfile, remove_lock_entry, upsert_lock_entry


def _sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


class SkillInstaller:
    """Install script-based skills into local cache and update lockfile."""

    def __init__(self, cache_root: str | Path, lockfile_path: str | Path) -> None:
        self.cache_root = Path(cache_root)
        self.lockfile_path = Path(lockfile_path)

    def install_script_skill(
        self,
        *,
        skill_id: str,
        source: str,
        version: str,
        artifact_url: str,
        expected_checksum: str = "",
        publisher: str = "",
    ) -> Path:
        response = httpx.get(artifact_url, timeout=20.0)
        response.raise_for_status()
        content = response.content
        checksum = _sha256_hex(content)
        if expected_checksum and checksum != expected_checksum:
            raise ValueError("Skill artifact checksum mismatch")

        install_dir = self.cache_root / source / skill_id / (version or "latest")
        install_dir.mkdir(parents=True, exist_ok=True)
        script_path = install_dir / "entry.py"
        script_path.write_bytes(content)

        upsert_lock_entry(
            self.lockfile_path,
            SkillLockEntry(
                skill_id=skill_id,
                source=source,
                version=version,
                publisher=publisher,
                artifact_url=artifact_url,
                checksum=checksum,
                installed_path=str(script_path),
                installed_at=datetime.now(timezone.utc).isoformat(),
            ),
        )
        return script_path

    def uninstall_skill(self, skill_id: str) -> Path | None:
        entries = read_lockfile(self.lockfile_path)
        entry = entries.get(skill_id)
        if entry is None:
            remove_lock_entry(self.lockfile_path, skill_id)
            return None

        path = Path(entry.installed_path)
        if path.exists():
            try:
                path.unlink()
            except IsADirectoryError:
                pass
        remove_lock_entry(self.lockfile_path, skill_id)
        return path
