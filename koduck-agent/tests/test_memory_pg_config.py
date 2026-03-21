"""Tests for PostgreSQL connection URL resolution in memory_pg."""

from __future__ import annotations

from koduck import memory_pg


def test_db_url_prefers_memory_database_url(monkeypatch) -> None:
    monkeypatch.setenv("MEMORY_DATABASE_URL", "postgresql://a:b@x:5432/d1")
    monkeypatch.setenv("DATABASE_URL", "postgresql://c:d@y:5432/d2")
    assert memory_pg._db_url() == "postgresql://a:b@x:5432/d1"


def test_db_url_falls_back_to_postgres_envs(monkeypatch) -> None:
    monkeypatch.delenv("MEMORY_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_HOST", "postgresql")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "koduck_dev")
    monkeypatch.setenv("POSTGRES_USER", "koduck")
    monkeypatch.setenv("POSTGRES_PASSWORD", "koduck")
    assert memory_pg._db_url() == "postgresql://koduck:koduck@postgresql:5432/koduck_dev"


def test_db_url_falls_back_to_db_envs(monkeypatch) -> None:
    monkeypatch.delenv("MEMORY_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_HOST", raising=False)
    monkeypatch.delenv("POSTGRES_PORT", raising=False)
    monkeypatch.delenv("POSTGRES_DB", raising=False)
    monkeypatch.delenv("POSTGRES_USER", raising=False)
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    monkeypatch.setenv("DB_HOST", "postgresql")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "koduck_dev")
    monkeypatch.setenv("DB_USERNAME", "koduck")
    monkeypatch.setenv("DB_PASSWORD", "koduck")
    assert memory_pg._db_url() == "postgresql://koduck:koduck@postgresql:5432/koduck_dev"
