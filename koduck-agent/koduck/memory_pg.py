"""Built-in PostgreSQL memory operations for koduck-agent.

Implements PageIndex-style 3-level memory:
- L1 raw compressed pages
- L2 themes
- L3 keyword inverted index
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import uuid
import zlib
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

WORD_RE = re.compile(r"[A-Za-z0-9_\-]{2,}|[\u4e00-\u9fff]{2,}")


@dataclass
class MemoryConfig:
    user_id: int
    mode: str = "L0"
    enabled: bool = True
    enable_l1: bool = True
    enable_l2: bool = True
    enable_l3: bool = True
    write_per_turn: bool = True
    async_index: bool = True
    retrieve_max_pages: int = 8
    retrieve_token_budget: int = 1500
    ttl_days_l1: int = 30
    ttl_days_l2: int = 90
    ttl_days_l3: int = 180


def _psycopg_module():
    try:
        import psycopg

        return psycopg
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("psycopg is required (pip install psycopg[binary])") from exc


def _db_url() -> str:
    value = os.getenv("MEMORY_DATABASE_URL") or os.getenv("DATABASE_URL")
    if value:
        return value

    host = (
        os.getenv("POSTGRES_HOST")
        or os.getenv("DB_HOST")
        or "localhost"
    ).strip()
    port = (
        os.getenv("POSTGRES_PORT")
        or os.getenv("DB_PORT")
        or "5432"
    ).strip()
    db_name = (
        os.getenv("POSTGRES_DB")
        or os.getenv("DB_NAME")
        or "koduck_dev"
    ).strip()
    user = (
        os.getenv("POSTGRES_USER")
        or os.getenv("DB_USERNAME")
        or "koduck"
    ).strip()
    password = (
        os.getenv("POSTGRES_PASSWORD")
        or os.getenv("DB_PASSWORD")
        or "koduck"
    ).strip()

    if not host or not port or not db_name or not user:
        raise RuntimeError(
            "Missing PostgreSQL connection info. "
            "Set MEMORY_DATABASE_URL/DATABASE_URL or POSTGRES_*/DB_* env vars."
        )

    return f"postgresql://{quote(user)}:{quote(password)}@{host}:{port}/{db_name}"


def _connect():
    return _psycopg_module().connect(_db_url())


def _bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _extract_keywords(text: str, limit: int = 16) -> list[str]:
    words = [w.lower() for w in WORD_RE.findall(text or "")]
    scored: dict[str, int] = {}
    for w in words:
        if len(w) < 2:
            continue
        scored[w] = scored.get(w, 0) + 1
    return [k for k, _ in sorted(scored.items(), key=lambda x: (-x[1], x[0]))[:limit]]


def _normalize_keywords(values: Any, limit: int = 16) -> list[str]:
    if not isinstance(values, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, str):
            continue
        cleaned = item.strip().lower()
        if len(cleaned) < 2 or cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned)
        if len(out) >= limit:
            break
    return out


def _provider_name(arguments: dict[str, Any]) -> str:
    raw = str(
        arguments.get("provider")
        or os.getenv("MEMORY_EXTRACTOR_PROVIDER")
        or os.getenv("LLM_PROVIDER")
        or "minimax"
    ).strip().lower()
    if raw in {"openai", "deepseek", "minimax"}:
        return raw
    return "minimax"


def _provider_api_key(provider: str, arguments: dict[str, Any]) -> str:
    override = str(arguments.get("api_key", "") or "").strip()
    if override:
        return override
    if provider == "openai":
        return str(
            os.getenv("OPENAI_API_KEY")
            or os.getenv("GPT_API_KEY")
            or os.getenv("LLM_API_KEY")
            or ""
        ).strip()
    if provider == "deepseek":
        return str(os.getenv("DEEPSEEK_API_KEY") or os.getenv("LLM_API_KEY") or "").strip()
    return str(os.getenv("MINIMAX_API_KEY") or os.getenv("LLM_API_KEY") or "").strip()


def _provider_api_base(provider: str, arguments: dict[str, Any]) -> str:
    override = str(arguments.get("api_base", "") or "").strip()
    if override:
        return override
    if provider == "openai":
        return str(os.getenv("OPENAI_API_BASE") or os.getenv("LLM_API_BASE") or "https://api.openai.com/v1").strip()
    if provider == "deepseek":
        return str(os.getenv("DEEPSEEK_API_BASE") or os.getenv("LLM_API_BASE") or "https://api.deepseek.com/v1").strip()
    return str(os.getenv("MINIMAX_API_BASE") or os.getenv("LLM_API_BASE") or "https://api.minimax.chat/v1").strip()


def _provider_model(provider: str, arguments: dict[str, Any]) -> str:
    override = str(arguments.get("model", "") or "").strip()
    if override:
        return override
    env_model = str(os.getenv("MEMORY_EXTRACTOR_MODEL") or "").strip()
    if env_model:
        return env_model
    if provider == "openai":
        return str(os.getenv("OPENAI_MODEL") or "gpt-4o-mini").strip()
    if provider == "deepseek":
        return str(os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip()
    return str(os.getenv("MINIMAX_MODEL") or "MiniMax-M2.5").strip()


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    candidate = text.strip()
    try:
        data = json.loads(candidate)
        return data if isinstance(data, dict) else None
    except Exception:
        pass

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(candidate[start : end + 1])
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _llm_extract_metadata(text: str, arguments: dict[str, Any]) -> dict[str, Any] | None:
    provider = _provider_name(arguments)
    api_key = _provider_api_key(provider, arguments)
    api_base = _provider_api_base(provider, arguments).rstrip("/")
    model = _provider_model(provider, arguments)
    if not api_key or not api_base:
        return None

    system_prompt = (
        "You are a memory index extractor. "
        "Return strict JSON with keys: theme, summary, keywords. "
        "theme: short snake_case topic label. "
        "summary: concise sentence <= 120 chars. "
        "keywords: array of 5-12 core keywords."
    )
    user_prompt = f"Content:\n{text[:4000]}"
    url = f"{api_base}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            return None
        body = resp.json()
        content = (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        data = _extract_json_object(content)
        if not data:
            return None
        theme = str(data.get("theme", "") or "").strip().lower().replace(" ", "_")
        summary = str(data.get("summary", "") or "").strip()
        keywords = _normalize_keywords(data.get("keywords"), limit=12)
        if not theme:
            theme = "general"
        if not summary:
            summary = (text or "")[:240]
        if not keywords:
            keywords = _extract_keywords(text, limit=12)
        return {"theme": theme[:64], "summary": summary[:240], "keywords": keywords}
    except Exception:
        return None


def _extract_metadata(text: str, arguments: dict[str, Any]) -> dict[str, Any]:
    # Default strategy: LLM extraction first; lexical fallback only when unavailable.
    llm = _llm_extract_metadata(text, arguments)
    if llm is not None:
        return llm
    return {
        "theme": "general",
        "summary": (text or "")[:240],
        "keywords": _extract_keywords(text, limit=12),
    }


def _get_config(conn: Any, user_id: int) -> MemoryConfig:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM memory_config WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
    if not row:
        return MemoryConfig(user_id=user_id)

    cols = [
        "user_id",
        "mode",
        "enabled",
        "enable_l1",
        "enable_l2",
        "enable_l3",
        "write_per_turn",
        "async_index",
        "retrieve_max_pages",
        "retrieve_token_budget",
        "ttl_days_l1",
        "ttl_days_l2",
        "ttl_days_l3",
        "updated_at",
    ]
    data = dict(zip(cols, row))
    return MemoryConfig(
        user_id=data["user_id"],
        mode=data["mode"],
        enabled=data["enabled"],
        enable_l1=data["enable_l1"],
        enable_l2=data["enable_l2"],
        enable_l3=data["enable_l3"],
        write_per_turn=data["write_per_turn"],
        async_index=data["async_index"],
        retrieve_max_pages=data["retrieve_max_pages"],
        retrieve_token_budget=data["retrieve_token_budget"],
        ttl_days_l1=data["ttl_days_l1"],
        ttl_days_l2=data["ttl_days_l2"],
        ttl_days_l3=data["ttl_days_l3"],
    )


def set_config(arguments: dict[str, Any]) -> dict[str, Any]:
    user_id = int(arguments.get("user_id", 0) or 0)
    if user_id <= 0:
        return {"ok": False, "error": "user_id is required"}

    values = MemoryConfig(
        user_id=user_id,
        mode=str(arguments.get("mode", "L0") or "L0").upper(),
        enabled=_bool(arguments.get("enabled"), True),
        enable_l1=_bool(arguments.get("enable_l1"), True),
        enable_l2=_bool(arguments.get("enable_l2"), True),
        enable_l3=_bool(arguments.get("enable_l3"), True),
        write_per_turn=_bool(arguments.get("write_per_turn"), True),
        async_index=_bool(arguments.get("async_index"), True),
        retrieve_max_pages=int(arguments.get("retrieve_max_pages", 8) or 8),
        retrieve_token_budget=int(arguments.get("retrieve_token_budget", 1500) or 1500),
        ttl_days_l1=int(arguments.get("ttl_days_l1", 30) or 30),
        ttl_days_l2=int(arguments.get("ttl_days_l2", 90) or 90),
        ttl_days_l3=int(arguments.get("ttl_days_l3", 180) or 180),
    )

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO memory_config (
                    user_id, mode, enabled, enable_l1, enable_l2, enable_l3,
                    write_per_turn, async_index, retrieve_max_pages, retrieve_token_budget,
                    ttl_days_l1, ttl_days_l2, ttl_days_l3, updated_at
                ) VALUES (
                    %(user_id)s, %(mode)s, %(enabled)s, %(enable_l1)s, %(enable_l2)s, %(enable_l3)s,
                    %(write_per_turn)s, %(async_index)s, %(retrieve_max_pages)s, %(retrieve_token_budget)s,
                    %(ttl_days_l1)s, %(ttl_days_l2)s, %(ttl_days_l3)s, NOW()
                )
                ON CONFLICT (user_id)
                DO UPDATE SET
                    mode = EXCLUDED.mode,
                    enabled = EXCLUDED.enabled,
                    enable_l1 = EXCLUDED.enable_l1,
                    enable_l2 = EXCLUDED.enable_l2,
                    enable_l3 = EXCLUDED.enable_l3,
                    write_per_turn = EXCLUDED.write_per_turn,
                    async_index = EXCLUDED.async_index,
                    retrieve_max_pages = EXCLUDED.retrieve_max_pages,
                    retrieve_token_budget = EXCLUDED.retrieve_token_budget,
                    ttl_days_l1 = EXCLUDED.ttl_days_l1,
                    ttl_days_l2 = EXCLUDED.ttl_days_l2,
                    ttl_days_l3 = EXCLUDED.ttl_days_l3,
                    updated_at = NOW()
                """,
                values.__dict__,
            )
        conn.commit()
    return {"ok": True, "action": "memory_set_config", "config": values.__dict__}


def write_l1(arguments: dict[str, Any]) -> dict[str, Any]:
    user_id = int(arguments.get("user_id", 0) or 0)
    content = str(arguments.get("content", "") or "")
    if user_id <= 0:
        return {"ok": False, "error": "user_id is required"}
    if not content:
        return {"ok": False, "error": "content is required"}

    raw_bytes = content.encode("utf-8")
    compressed = zlib.compress(raw_bytes, level=6)
    md5 = hashlib.md5(raw_bytes).hexdigest()

    meta = arguments.get("meta")
    if not isinstance(meta, dict):
        meta = {}

    with _connect() as conn:
        cfg = _get_config(conn, user_id)
        if not cfg.enabled or not cfg.enable_l1:
            return {"ok": False, "skipped": True, "reason": "L1 disabled by config"}

        page_id = uuid.uuid4()
        expires_at = dt.datetime.utcnow() + dt.timedelta(days=cfg.ttl_days_l1)

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO memory_l1_pages (
                    id, user_id, session_id, role_pack, ts, content_compressed,
                    codec, md5, size_raw, size_compressed, meta, expires_at
                ) VALUES (
                    %s, %s, %s, %s, NOW(), %s,
                    'zlib', %s, %s, %s, %s::jsonb, %s
                )
                """,
                (
                    str(page_id),
                    user_id,
                    str(arguments.get("session_id", "") or ""),
                    str(arguments.get("role_pack", "chat") or "chat"),
                    compressed,
                    md5,
                    len(raw_bytes),
                    len(compressed),
                    json.dumps(meta, ensure_ascii=False),
                    expires_at,
                ),
            )
        conn.commit()

    return {
        "ok": True,
        "action": "memory_write_l1",
        "page_id": str(page_id),
        "md5": md5,
        "size_raw": len(raw_bytes),
        "size_compressed": len(compressed),
    }


def rebuild_l2(arguments: dict[str, Any]) -> dict[str, Any]:
    user_id = int(arguments.get("user_id", 0) or 0)
    limit = int(arguments.get("limit", 200) or 200)
    if user_id <= 0:
        return {"ok": False, "error": "user_id is required"}

    with _connect() as conn:
        cfg = _get_config(conn, user_id)
        if not cfg.enabled or not cfg.enable_l2:
            return {"ok": False, "skipped": True, "reason": "L2 disabled by config"}

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, content_compressed
                FROM memory_l1_pages
                WHERE user_id = %s
                ORDER BY ts DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()

        themes: dict[str, dict[str, Any]] = {}
        for page_id, blob in rows:
            try:
                text = zlib.decompress(blob).decode("utf-8", errors="replace")
            except Exception:
                continue
            meta = _extract_metadata(text, arguments)
            theme_name = str(meta.get("theme", "general") or "general")
            kws = _normalize_keywords(meta.get("keywords"), limit=12) or _extract_keywords(text, limit=12)
            summary = str(meta.get("summary", "") or text[:240])[:240]
            entry = themes.setdefault(
                theme_name,
                {"page_ids": [], "keywords": {}, "summary": summary},
            )
            entry["page_ids"].append(str(page_id))
            for kw in kws:
                entry["keywords"][kw] = entry["keywords"].get(kw, 0) + 1

        with conn.cursor() as cur:
            for theme_name, payload in themes.items():
                theme_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"{user_id}:{theme_name}")
                keywords = [k for k, _ in sorted(payload["keywords"].items(), key=lambda x: (-x[1], x[0]))[:24]]
                expires_at = dt.datetime.utcnow() + dt.timedelta(days=cfg.ttl_days_l2)
                cur.execute(
                    """
                    INSERT INTO memory_l2_themes (
                        id, user_id, theme_name, summary, keywords, page_ids, updated_at, expires_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, NOW(), %s
                    )
                    ON CONFLICT (user_id, theme_name)
                    DO UPDATE SET
                        summary = EXCLUDED.summary,
                        keywords = EXCLUDED.keywords,
                        page_ids = EXCLUDED.page_ids,
                        updated_at = NOW(),
                        expires_at = EXCLUDED.expires_at
                    """,
                    (
                        str(theme_id),
                        user_id,
                        theme_name,
                        payload["summary"],
                        keywords,
                        payload["page_ids"],
                        expires_at,
                    ),
                )
        conn.commit()

    return {"ok": True, "action": "memory_rebuild_l2", "themes": len(themes)}


def rebuild_l3(arguments: dict[str, Any]) -> dict[str, Any]:
    user_id = int(arguments.get("user_id", 0) or 0)
    if user_id <= 0:
        return {"ok": False, "error": "user_id is required"}

    with _connect() as conn:
        cfg = _get_config(conn, user_id)
        if not cfg.enabled or not cfg.enable_l3:
            return {"ok": False, "skipped": True, "reason": "L3 disabled by config"}

        with conn.cursor() as cur:
            cur.execute("DELETE FROM memory_l3_keywords WHERE user_id = %s", (user_id,))

            cur.execute(
                """
                SELECT id, theme_name, keywords, page_ids
                FROM memory_l2_themes
                WHERE user_id = %s
                """,
                (user_id,),
            )
            rows = cur.fetchall()

            total = 0
            for theme_id, theme_name, keywords, page_ids in rows:
                base = _extract_keywords(theme_name, limit=8)
                merged = list(dict.fromkeys((keywords or []) + base))
                for idx, kw in enumerate(merged):
                    weight = max(0.2, 1.0 - idx * 0.03)
                    sample_page = (page_ids or [None])[0]
                    cur.execute(
                        """
                        INSERT INTO memory_l3_keywords (
                            user_id, keyword, theme_id, page_id, weight, ts
                        ) VALUES (
                            %s, %s, %s, %s, %s, NOW()
                        )
                        """,
                        (user_id, kw, str(theme_id), sample_page, weight),
                    )
                    total += 1
        conn.commit()

    return {"ok": True, "action": "memory_rebuild_l3", "indexed_keywords": total}


def query(arguments: dict[str, Any]) -> dict[str, Any]:
    user_id = int(arguments.get("user_id", 0) or 0)
    query_text = str(arguments.get("query", "") or "")
    if user_id <= 0:
        return {"ok": False, "error": "user_id is required"}
    if not query_text:
        return {"ok": False, "error": "query is required"}

    query_keywords = _extract_keywords(query_text, limit=12)

    with _connect() as conn:
        cfg = _get_config(conn, user_id)
        max_pages = int(arguments.get("max_pages", 0) or 0) or cfg.retrieve_max_pages

        theme_ids: set[str] = set()
        page_ids: list[str] = []

        with conn.cursor() as cur:
            if query_keywords and cfg.enable_l3:
                cur.execute(
                    """
                    SELECT theme_id, page_id, weight
                    FROM memory_l3_keywords
                    WHERE user_id = %s AND keyword = ANY(%s)
                    ORDER BY weight DESC, ts DESC
                    LIMIT 200
                    """,
                    (user_id, query_keywords),
                )
                for t_id, p_id, _ in cur.fetchall():
                    if t_id:
                        theme_ids.add(str(t_id))
                    if p_id:
                        page_ids.append(str(p_id))

            themes: list[dict[str, Any]] = []
            if cfg.enable_l2 and theme_ids:
                cur.execute(
                    """
                    SELECT id, theme_name, summary, keywords, page_ids
                    FROM memory_l2_themes
                    WHERE user_id = %s AND id::text = ANY(%s)
                    ORDER BY updated_at DESC
                    LIMIT 20
                    """,
                    (user_id, list(theme_ids)),
                )
                for row in cur.fetchall():
                    themes.append(
                        {
                            "id": str(row[0]),
                            "theme": row[1],
                            "summary": row[2],
                            "keywords": row[3] or [],
                            "page_ids": [str(x) for x in (row[4] or [])],
                        }
                    )
                    for p in row[4] or []:
                        page_ids.append(str(p))

            uniq_page_ids = list(dict.fromkeys(page_ids))[:max_pages]
            pages: list[dict[str, Any]] = []
            if cfg.enable_l1 and uniq_page_ids:
                cur.execute(
                    """
                    SELECT id, ts, role_pack, md5, content_compressed
                    FROM memory_l1_pages
                    WHERE user_id = %s AND id::text = ANY(%s)
                    ORDER BY ts DESC
                    """,
                    (user_id, uniq_page_ids),
                )
                for pid, ts, role_pack, md5, blob in cur.fetchall():
                    text = zlib.decompress(blob).decode("utf-8", errors="replace")
                    pages.append(
                        {
                            "id": str(pid),
                            "ts": ts,
                            "role_pack": role_pack,
                            "md5": md5,
                            "content": text,
                        }
                    )

    inject_lines: list[str] = []
    for t in themes[:5]:
        inject_lines.append(f"[Theme] {t['theme']}: {t['summary']}")
    for p in pages[:max_pages]:
        snippet = (p["content"] or "")[:300]
        inject_lines.append(f"[Page:{p['id']}] {snippet}")

    return {
        "ok": True,
        "action": "memory_query",
        "query": query_text,
        "query_keywords": query_keywords,
        "themes": themes,
        "pages": pages,
        "injected_context": "\n".join(inject_lines),
    }


def cleanup(arguments: dict[str, Any]) -> dict[str, Any]:
    user_id = int(arguments.get("user_id", 0) or 0)
    if user_id <= 0:
        return {"ok": False, "error": "user_id is required"}

    with _connect() as conn:
        cfg = _get_config(conn, user_id)
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM memory_l1_pages WHERE user_id = %s AND expires_at < NOW()",
                (user_id,),
            )
            l1_deleted = cur.rowcount

            cur.execute(
                "DELETE FROM memory_l2_themes WHERE user_id = %s AND expires_at < NOW()",
                (user_id,),
            )
            l2_deleted = cur.rowcount

            cutoff = dt.datetime.utcnow() - dt.timedelta(days=cfg.ttl_days_l3)
            cur.execute(
                "DELETE FROM memory_l3_keywords WHERE user_id = %s AND ts < %s",
                (user_id, cutoff),
            )
            l3_deleted = cur.rowcount
        conn.commit()

    return {
        "ok": True,
        "action": "memory_cleanup",
        "deleted": {
            "l1_pages": l1_deleted,
            "l2_themes": l2_deleted,
            "l3_keywords": l3_deleted,
        },
    }
