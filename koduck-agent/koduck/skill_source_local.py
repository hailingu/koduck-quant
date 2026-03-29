"""Local filesystem-based skill source."""

from __future__ import annotations

import os
import re
from pathlib import Path

from koduck.skill_source import SkillEntry

try:
    import yaml
except Exception:  # pragma: no cover
    yaml = None


def _normalize_skill_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return normalized or "skill"


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
            return skill_name, description

    return skill_name, description


class LocalSkillSource:
    """Discover skills from local skill directories."""

    def __init__(self, roots: list[Path] | None = None) -> None:
        self._roots = roots

    def _skill_roots(self) -> list[Path]:
        if self._roots:
            return self._roots

        env_value = os.getenv("KODUCK_SKILLS_DIRS", "").strip()
        roots: list[Path] = []

        if env_value:
            for raw in env_value.split(os.pathsep):
                candidate = Path(raw).expanduser().resolve()
                if candidate.is_dir():
                    roots.append(candidate)
        else:
            candidates: list[Path] = [Path.cwd()]
            candidates.extend(Path(__file__).resolve().parents)
            for base in candidates:
                skill_root = (base / ".github" / "skills").resolve()
                if skill_root.is_dir():
                    roots.append(skill_root)

        deduped: list[Path] = []
        seen: set[str] = set()
        for root in roots:
            key = str(root)
            if key not in seen:
                seen.add(key)
                deduped.append(root)
        return deduped

    def discover(self) -> list[SkillEntry]:
        discovered: list[SkillEntry] = []
        for root in self._skill_roots():
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
                    SkillEntry(
                        tool_name=tool_name,
                        skill_name=skill_name,
                        description=description,
                        script_path=script_path,
                        skill_md=skill_md,
                        source="local",
                    )
                )

        merged: dict[str, SkillEntry] = {}
        for item in discovered:
            merged[item.tool_name] = item
        return list(merged.values())
