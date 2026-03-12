"""Trading hours utility for A-share market.

Provides functions to check if the current time or a given datetime
is within A-share trading hours.
"""

import logging
from datetime import datetime, time
from typing import Optional

import pytz

logger = logging.getLogger(__name__)

# A-share trading sessions (Beijing Time), including call auction.
MORNING_START = time(9, 15)
MORNING_END = time(11, 30)
AFTERNOON_START = time(13, 0)
AFTERNOON_END = time(15, 0)


def is_a_share_trading_time(dt: Optional[datetime] = None) -> bool:
    """Check if the given datetime is within A-share trading hours.

    A-share trading sessions (Beijing Time):
    - Morning (including call auction): 09:15 - 11:30
    - Afternoon: 13:00 - 15:00
    - Monday to Friday only

    Args:
        dt: datetime to check (default: now in Beijing time)

    Returns:
        True if within trading hours, False otherwise
    """
    if dt is None:
        # Use Beijing time
        beijing_tz = pytz.timezone('Asia/Shanghai')
        dt = datetime.now(beijing_tz)
    elif dt.tzinfo is None:
        # Assume naive datetime is Beijing time
        beijing_tz = pytz.timezone('Asia/Shanghai')
        dt = beijing_tz.localize(dt)
    else:
        # Convert to Beijing time if needed
        beijing_tz = pytz.timezone('Asia/Shanghai')
        dt = dt.astimezone(beijing_tz)

    # Check weekday (0=Monday, 5=Saturday, 6=Sunday)
    if dt.weekday() >= 5:
        return False

    current_time = dt.time()

    # Check trading hours
    is_morning = MORNING_START <= current_time <= MORNING_END
    is_afternoon = AFTERNOON_START <= current_time <= AFTERNOON_END

    return is_morning or is_afternoon


def is_market_open(dt: Optional[datetime] = None) -> bool:
    """Alias for is_a_share_trading_time for better readability.
    
    Args:
        dt: datetime to check (default: now in Beijing time)
        
    Returns:
        True if market is open, False otherwise
    """
    return is_a_share_trading_time(dt)
