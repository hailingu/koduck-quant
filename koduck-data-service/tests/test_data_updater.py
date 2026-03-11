"""Tests for data updater helpers."""

import pytest

from app.services.data_updater import DataUpdater


@pytest.mark.parametrize(
    ("symbol", "expected"),
    [
        ("601012", "1"),
        ("510300", "1"),
        ("002885", "0"),
        ("300750", "0"),
        ("920077", "0"),
        ("830799", "0"),
    ],
)
def test_resolve_secid_prefix(symbol: str, expected: str) -> None:
    """Should map Shanghai symbols to prefix 1 and SZ/BJ symbols to 0."""
    assert DataUpdater._resolve_secid_prefix(symbol) == expected
