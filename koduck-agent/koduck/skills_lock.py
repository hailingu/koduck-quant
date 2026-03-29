"""Skill lockfile read/write helpers."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class SkillLockEntry:
    """Pinned skill metadata."""

    skill_id: str
    source: str
    version: str
    publisher: str = ""
    artifact_url: str = ""
    checksum: str = ""
    installed_path: str = ""
    installed_at: str = ""


def read_lockfile(path: str | Path) -> dict[str, SkillLockEntry]:
    lock_path = Path(path)
    if not lock_path.exists():
        return {}
    raw = json.loads(lock_path.read_text(encoding="utf-8") or "{}")
    if not isinstance(raw, dict):
        return {}
    items = raw.get("skills", {})
    if not isinstance(items, dict):
        return {}
    parsed: dict[str, SkillLockEntry] = {}
    for key, value in items.items():
        if not isinstance(value, dict):
            continue
        parsed[str(key)] = SkillLockEntry(
            skill_id=str(value.get("skill_id") or key),
            source=str(value.get("source") or ""),
            version=str(value.get("version") or ""),
            publisher=str(value.get("publisher") or ""),
            artifact_url=str(value.get("artifact_url") or ""),
            checksum=str(value.get("checksum") or ""),
            installed_path=str(value.get("installed_path") or ""),
            installed_at=str(value.get("installed_at") or ""),
        )
    return parsed


def write_lockfile(path: str | Path, entries: dict[str, SkillLockEntry]) -> None:
    lock_path = Path(path)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "skills": {key: asdict(value) for key, value in sorted(entries.items())},
    }
    lock_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upsert_lock_entry(path: str | Path, entry: SkillLockEntry) -> dict[str, SkillLockEntry]:
    entries = read_lockfile(path)
    entries[entry.skill_id] = entry
    write_lockfile(path, entries)
    return entries


def remove_lock_entry(path: str | Path, skill_id: str) -> dict[str, SkillLockEntry]:
    entries = read_lockfile(path)
    entries.pop(skill_id, None)
    write_lockfile(path, entries)
    return entries
