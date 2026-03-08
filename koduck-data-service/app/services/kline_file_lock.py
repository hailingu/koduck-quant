"""K-line CSV file lock mechanism to prevent concurrent writes.

This module provides file-level locking for CSV operations to prevent
race conditions between initialization and runtime updates.
"""

import fcntl
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

# Lock directory
LOCK_DIR = Path(__file__).parent.parent.parent / "data" / "locks"


def ensure_lock_dir() -> None:
    """Ensure lock directory exists."""
    LOCK_DIR.mkdir(parents=True, exist_ok=True)


@contextmanager
def csv_lock(symbol: str, timeframe: str = "1D", blocking: bool = False) -> Generator[bool, None, None]:
    """Acquire a file lock for CSV operations.
    
    Args:
        symbol: Stock symbol
        timeframe: Timeframe (e.g., "1D", "5m")
        blocking: If True, wait until lock is available. If False, return immediately.
        
    Yields:
        True if lock acquired, False otherwise (non-blocking only)
        
    Example:
        with csv_lock("601012", "1D") as acquired:
            if acquired:
                # Safe to read/write CSV
                update_csv()
            else:
                logger.warning("CSV is locked, skipping")
    """
    ensure_lock_dir()
    
    lock_file = LOCK_DIR / f"{symbol}_{timeframe}.lock"
    lock_path = str(lock_file)
    
    # Create lock file if not exists
    lock_file.touch(exist_ok=True)
    
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT)
    
    try:
        if blocking:
            # Blocking mode: wait until lock is available
            fcntl.flock(fd, fcntl.LOCK_EX)
            yield True
        else:
            # Non-blocking mode: try to acquire lock
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                yield True
            except BlockingIOError:
                yield False
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


@contextmanager
def csv_read_lock(symbol: str, timeframe: str = "1D") -> Generator[bool, None, None]:
    """Acquire a shared (read) lock for CSV operations.
    
    Multiple readers can hold the lock simultaneously, but writers
    must wait for all readers to release.
    
    Args:
        symbol: Stock symbol
        timeframe: Timeframe
        
    Yields:
        True if lock acquired
    """
    ensure_lock_dir()
    
    lock_file = LOCK_DIR / f"{symbol}_{timeframe}.lock"
    lock_path = str(lock_file)
    
    lock_file.touch(exist_ok=True)
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT)
    
    try:
        # Shared lock for reading
        fcntl.flock(fd, fcntl.LOCK_SH)
        yield True
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def is_csv_locked(symbol: str, timeframe: str = "1D") -> bool:
    """Check if a CSV file is currently locked (non-invasive).
    
    Args:
        symbol: Stock symbol
        timeframe: Timeframe
        
    Returns:
        True if file is locked, False otherwise
    """
    ensure_lock_dir()
    
    lock_file = LOCK_DIR / f"{symbol}_{timeframe}.lock"
    lock_path = str(lock_file)
    
    if not lock_file.exists():
        return False
    
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT)
    
    try:
        # Try to acquire non-blocking exclusive lock
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # If we got here, file was not locked
        fcntl.flock(fd, fcntl.LOCK_UN)
        return False
    except BlockingIOError:
        return True
    finally:
        os.close(fd)
