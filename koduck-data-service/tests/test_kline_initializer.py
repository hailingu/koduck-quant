"""Unit tests for K-line initializer."""

import asyncio
from pathlib import Path
from typing import Any

from app.services.kline_initializer import KlineInitializer


def test_detect_timeframe_prefers_parent_folder() -> None:
    """Detect timeframe from CSV parent directory name."""
    initializer = KlineInitializer()
    path = Path("data/kline/5m/000001.csv")

    assert initializer.detect_timeframe(path) == "5m"


def test_detect_timeframe_fallback_to_default() -> None:
    """Fallback to default timeframe when path does not match expected layout."""
    initializer = KlineInitializer()
    path = Path("random/000001.csv")

    assert initializer.detect_timeframe(path) == "1D"


def test_initialize_returns_true_when_no_csv_files(monkeypatch: Any) -> None:
    """Initialization should be successful when no CSV files are available."""
    initializer = KlineInitializer()

    monkeypatch.setattr(initializer, "find_csv_files", lambda _timeframes=None: [])

    result = asyncio.run(initializer.initialize())

    assert result is True


def test_initialize_returns_false_when_any_file_fails(monkeypatch: Any) -> None:
    """Initialization should fail when at least one file import fails."""
    initializer = KlineInitializer()
    files = [Path("fixtures/a.csv"), Path("fixtures/b.csv")]

    def fake_find_csv_files(_timeframes: list[str] | None = None) -> list[Path]:
        del _timeframes
        return files

    monkeypatch.setattr(initializer, "find_csv_files", fake_find_csv_files)

    async def fake_import_csv_file(
        csv_path: Path, batch_size: int = 100
    ) -> dict[str, Any]:
        del batch_size
        await asyncio.sleep(0)
        if csv_path.name == "a.csv":
            return {
                "file": str(csv_path),
                "success": True,
                "imported": 10,
                "skipped": 0,
                "error": None,
            }
        return {
            "file": str(csv_path),
            "success": False,
            "imported": 0,
            "skipped": 0,
            "error": "mock error",
        }

    monkeypatch.setattr(initializer, "import_csv_file", fake_import_csv_file)

    result = asyncio.run(initializer.initialize())

    assert result is False


def test_run_returns_true_when_initialization_not_needed(monkeypatch: Any) -> None:
    """Run should return success and set initialized when data is up to date."""
    initializer = KlineInitializer()

    async def check_table_exists() -> bool:
        await asyncio.sleep(0)
        return True

    async def check_needs_initialization() -> bool:
        await asyncio.sleep(0)
        return False

    monkeypatch.setattr(initializer, "check_table_exists", check_table_exists)
    monkeypatch.setattr(
        initializer,
        "check_needs_initialization",
        check_needs_initialization,
    )

    result = asyncio.run(initializer.run())

    assert result is True
    assert initializer._initialized is True


def test_ensure_retry_task_not_duplicated(monkeypatch: Any) -> None:
    """Ensure only one background retry task is created while active."""
    initializer = KlineInitializer()
    created = 0

    async def fake_retry(timeframes: list[str] | None = None) -> None:
        del timeframes
        await asyncio.sleep(0)

    monkeypatch.setattr(initializer, "_retry_initialization", fake_retry)

    original_create_task = asyncio.create_task

    def counting_create_task(coro: Any) -> asyncio.Task[Any]:
        nonlocal created
        created += 1
        return original_create_task(coro)

    monkeypatch.setattr(asyncio, "create_task", counting_create_task)

    async def runner() -> None:
        initializer._ensure_retry_task()
        initializer._ensure_retry_task()
        if initializer._retry_task is not None:
            await initializer._retry_task

    asyncio.run(runner())

    assert created == 1
