#!/usr/bin/env python3
"""Skill marketplace/install management CLI for koduck-agent."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from koduck.skill_installer import SkillInstaller
from koduck.skill_source_openclaw import OpenClawSkillSource
from koduck.skills_lock import SkillLockEntry, read_lockfile, upsert_lock_entry


def _agent_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _default_cache_dir() -> Path:
    return (_agent_root() / ".skill-cache").resolve()


def _default_lockfile() -> Path:
    return (_agent_root() / "skills.lock").resolve()


def _list_market(base_url: str) -> int:
    source = OpenClawSkillSource(base_url=base_url, enabled=True)
    skills = source.discover()
    payload = [
        {
            "skill_id": item.skill_name,
            "version": item.version,
            "publisher": item.publisher,
            "description": item.description,
            "artifact_url": item.artifact_url,
        }
        for item in skills
    ]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def _list_installed(lockfile_path: Path) -> int:
    entries = read_lockfile(lockfile_path)
    payload = [
        {
            "skill_id": entry.skill_id,
            "source": entry.source,
            "version": entry.version,
            "publisher": entry.publisher,
            "installed_path": entry.installed_path,
            "installed_at": entry.installed_at,
        }
        for entry in entries.values()
    ]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def _install_skill(
    *,
    base_url: str,
    cache_dir: Path,
    lockfile_path: Path,
    skill_id: str,
    version: str,
) -> int:
    source = OpenClawSkillSource(base_url=base_url, enabled=True)
    candidates = source.discover()
    target = None
    for item in candidates:
        if item.skill_name != skill_id:
            continue
        if version and item.version and item.version != version:
            continue
        target = item
        break

    if target is None:
        print(
            json.dumps(
                {"ok": False, "error": "skill not found in market", "skill_id": skill_id, "version": version},
                ensure_ascii=False,
            )
        )
        return 1

    if not target.artifact_url:
        print(
            json.dumps(
                {"ok": False, "error": "skill missing artifact_url", "skill_id": skill_id},
                ensure_ascii=False,
            )
        )
        return 1

    installer = SkillInstaller(cache_root=cache_dir, lockfile_path=lockfile_path)
    script_path = installer.install_script_skill(
        skill_id=target.skill_name,
        source="openclaw",
        version=target.version or version or "latest",
        artifact_url=target.artifact_url,
        publisher=target.publisher,
    )
    print(
        json.dumps(
            {
                "ok": True,
                "skill_id": target.skill_name,
                "version": target.version or version or "latest",
                "installed_path": str(script_path),
                "lockfile": str(lockfile_path),
            },
            ensure_ascii=False,
        )
    )
    return 0


def _uninstall_skill(cache_dir: Path, lockfile_path: Path, skill_id: str) -> int:
    installer = SkillInstaller(cache_root=cache_dir, lockfile_path=lockfile_path)
    removed_path = installer.uninstall_skill(skill_id)
    print(
        json.dumps(
            {
                "ok": True,
                "skill_id": skill_id,
                "removed_path": str(removed_path) if removed_path else "",
                "lockfile": str(lockfile_path),
            },
            ensure_ascii=False,
        )
    )
    return 0


def _verify_installed(lockfile_path: Path) -> int:
    entries = read_lockfile(lockfile_path)
    problems: list[dict[str, str]] = []
    for entry in entries.values():
        if entry.source != "openclaw":
            continue
        if not entry.installed_path or not Path(entry.installed_path).is_file():
            problems.append(
                {
                    "skill_id": entry.skill_id,
                    "reason": "installed_path missing",
                    "installed_path": entry.installed_path,
                }
            )
    print(
        json.dumps(
            {"ok": len(problems) == 0, "issues": problems, "checked": len(entries)},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if not problems else 1


def _detect_entry_script(skill_dir: Path) -> Path | None:
    candidates = []
    scripts_dir = skill_dir / "scripts"
    if scripts_dir.is_dir():
        candidates.extend(sorted(scripts_dir.glob("*.py")))
    candidates.extend(sorted(skill_dir.glob("*.py")))
    if not candidates:
        return None
    # Prefer files with common entry names.
    preferred_names = {"main.py", "entry.py", "run.py"}
    for candidate in candidates:
        if candidate.name in preferred_names:
            return candidate
    return candidates[0]


def _import_clawhub_dir(
    *,
    lockfile_path: Path,
    skill_id: str,
    skill_dir: Path,
    version: str,
    publisher: str,
) -> int:
    if not skill_dir.is_dir():
        print(
            json.dumps(
                {"ok": False, "error": "skill directory not found", "path": str(skill_dir)},
                ensure_ascii=False,
            )
        )
        return 1

    entry_script = _detect_entry_script(skill_dir)
    if entry_script is None:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "no python entry script found in skill directory",
                    "path": str(skill_dir),
                },
                ensure_ascii=False,
            )
        )
        return 1

    upsert_lock_entry(
        lockfile_path,
        SkillLockEntry(
            skill_id=skill_id,
            source="openclaw",
            version=version or "imported",
            publisher=publisher,
            artifact_url="",
            checksum="",
            installed_path=str(entry_script.resolve()),
            installed_at=datetime.now(timezone.utc).isoformat(),
        ),
    )
    print(
        json.dumps(
            {
                "ok": True,
                "skill_id": skill_id,
                "installed_path": str(entry_script.resolve()),
                "lockfile": str(lockfile_path),
                "mode": "import-clawhub-dir",
            },
            ensure_ascii=False,
        )
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage OpenClaw skills for koduck-agent")
    parser.add_argument(
        "--base-url",
        default=os.getenv("KODUCK_SKILL_MARKET_BASE_URL", "").strip(),
        help="OpenClaw skill market base URL",
    )
    parser.add_argument(
        "--cache-dir",
        default=os.getenv("KODUCK_SKILL_CACHE_DIR", str(_default_cache_dir())),
        help="Skill cache directory",
    )
    parser.add_argument(
        "--lockfile",
        default=os.getenv("KODUCK_SKILLS_LOCKFILE", str(_default_lockfile())),
        help="Skill lockfile path",
    )

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("market-list", help="List skills from market")
    sub.add_parser("installed", help="List installed skills from lockfile")

    install_cmd = sub.add_parser("install", help="Install one skill from market")
    install_cmd.add_argument("--skill-id", required=True, help="Skill id/name from market")
    install_cmd.add_argument("--version", default="", help="Optional required version")

    uninstall_cmd = sub.add_parser("uninstall", help="Uninstall one installed skill")
    uninstall_cmd.add_argument("--skill-id", required=True, help="Installed skill id")

    import_cmd = sub.add_parser(
        "import-clawhub-dir",
        help="Import an already downloaded ClawHub skill directory into lockfile",
    )
    import_cmd.add_argument("--skill-id", required=True, help="Skill id to write into lockfile")
    import_cmd.add_argument("--dir", required=True, help="Local skill directory path")
    import_cmd.add_argument("--version", default="imported", help="Version label for lockfile")
    import_cmd.add_argument("--publisher", default="clawhub", help="Publisher label for lockfile")

    sub.add_parser("verify", help="Verify installed skill files referenced by lockfile")

    args = parser.parse_args()
    cache_dir = Path(args.cache_dir).resolve()
    lockfile_path = Path(args.lockfile).resolve()

    if args.command == "market-list":
        if not args.base_url:
            print(json.dumps({"ok": False, "error": "--base-url is required"}, ensure_ascii=False))
            return 1
        return _list_market(args.base_url)
    if args.command == "installed":
        return _list_installed(lockfile_path)
    if args.command == "install":
        if not args.base_url:
            print(json.dumps({"ok": False, "error": "--base-url is required"}, ensure_ascii=False))
            return 1
        return _install_skill(
            base_url=args.base_url,
            cache_dir=cache_dir,
            lockfile_path=lockfile_path,
            skill_id=args.skill_id,
            version=args.version,
        )
    if args.command == "uninstall":
        return _uninstall_skill(cache_dir=cache_dir, lockfile_path=lockfile_path, skill_id=args.skill_id)
    if args.command == "import-clawhub-dir":
        return _import_clawhub_dir(
            lockfile_path=lockfile_path,
            skill_id=args.skill_id,
            skill_dir=Path(args.dir).resolve(),
            version=args.version,
            publisher=args.publisher,
        )
    if args.command == "verify":
        return _verify_installed(lockfile_path)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
