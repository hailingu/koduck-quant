"""Tests for realtime scheduler strategy decisions."""

from app.main import should_run_realtime_update


def test_should_run_only_during_trading_hours() -> None:
    """Only-during-trading mode should skip non-trading time updates."""
    assert should_run_realtime_update(True, True, False) is True
    assert should_run_realtime_update(False, True, False) is False


def test_should_run_skip_during_trading_hours_legacy() -> None:
    """Legacy skip-during-trading mode should run only outside trading."""
    assert should_run_realtime_update(True, False, True) is False
    assert should_run_realtime_update(False, False, True) is True


def test_should_run_always_when_no_restrictions() -> None:
    """Without either switch enabled, scheduler runs all the time."""
    assert should_run_realtime_update(True, False, False) is True
    assert should_run_realtime_update(False, False, False) is True


def test_only_mode_takes_priority_over_legacy_skip_mode() -> None:
    """When both switches are enabled, only-during-trading has priority."""
    assert should_run_realtime_update(True, True, True) is True
    assert should_run_realtime_update(False, True, True) is False