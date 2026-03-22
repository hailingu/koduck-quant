"""Tick data scheduler for automated maintenance tasks.

This module provides scheduled tasks for tick data management:
- Partition creation for future months
- Old data cleanup based on retention policy
- Data integrity checks
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

from app.db import Database, tick_history_db
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SchedulerTask:
    """Definition of a scheduled task."""
    name: str
    interval_seconds: int
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    run_count: int = 0
    error_count: int = 0
    enabled: bool = True


@dataclass
class PartitionInfo:
    """Information about a database partition."""
    table_name: str
    partition_name: str
    start_date: datetime
    end_date: datetime


@dataclass
class CleanupResult:
    """Result of cleanup operation."""
    deleted_count: int = 0
    retention_days: int = 0
    cutoff_date: Optional[datetime] = None
    duration_seconds: float = 0.0


@dataclass
class IntegrityCheckResult:
    """Result of data integrity check."""
    checked_symbols: int = 0
    issues_found: int = 0
    missing_data_symbols: List[str] = field(default_factory=list)
    gap_periods: List[Dict[str, Any]] = field(default_factory=list)
    duration_seconds: float = 0.0


class TickScheduler:
    """Scheduler for tick data maintenance tasks.
    
    Handles automated tasks such as:
    - Creating database partitions ahead of time
    - Cleaning up old tick data
    - Running data integrity checks
    """
    
    def __init__(self):
        self._running = False
        self._tasks: Dict[str, SchedulerTask] = {}
        self._task_handlers: Dict[str, callable] = {}
        self._scheduler_task: Optional[asyncio.Task] = None
        
        # Initialize default tasks
        self._init_default_tasks()
    
    def _init_default_tasks(self):
        """Initialize default scheduled tasks."""
        # Partition creation task - run daily
        self.register_task(
            SchedulerTask(
                name="create_partitions",
                interval_seconds=86400,  # 24 hours
                enabled=settings.TICK_HISTORY_ENABLED,
            ),
            self._create_partitions_task
        )
        
        # Data cleanup task - run weekly
        self.register_task(
            SchedulerTask(
                name="cleanup_old_data",
                interval_seconds=604800,  # 7 days
                enabled=settings.TICK_HISTORY_ENABLED,
            ),
            self._cleanup_old_data_task
        )
        
        # Integrity check task - run every 6 hours
        self.register_task(
            SchedulerTask(
                name="integrity_check",
                interval_seconds=21600,  # 6 hours
                enabled=settings.TICK_HISTORY_ENABLED,
            ),
            self._integrity_check_task
        )
    
    def register_task(self, task: SchedulerTask, handler: callable):
        """Register a scheduled task.
        
        Args:
            task: Task definition
            handler: Async function to execute
        """
        self._tasks[task.name] = task
        self._task_handlers[task.name] = handler
        logger.info(f"Registered scheduled task: {task.name} (interval: {task.interval_seconds}s)")
    
    async def start(self):
        """Start the scheduler."""
        if self._running:
            logger.warning("Scheduler is already running")
            return
        
        self._running = True
        logger.info("Starting tick scheduler...")
        
        # Initialize next_run times
        now = datetime.now()
        for task in self._tasks.values():
            if task.enabled:
                task.next_run = now
        
        # Start the scheduler loop
        self._scheduler_task = asyncio.create_task(self._scheduler_loop())
        logger.info("Tick scheduler started")
    
    async def stop(self):
        """Stop the scheduler."""
        if not self._running:
            return
        
        self._running = False
        logger.info("Stopping tick scheduler...")
        
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Tick scheduler stopped")
    
    async def _scheduler_loop(self):
        """Main scheduler loop."""
        while self._running:
            try:
                now = datetime.now()
                
                # Check and execute due tasks
                for task_name, task in self._tasks.items():
                    if not task.enabled:
                        continue
                    
                    if task.next_run and now >= task.next_run:
                        await self._execute_task(task_name)
                
                # Sleep for a short interval before next check
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}", exc_info=True)
                await asyncio.sleep(60)
    
    async def _execute_task(self, task_name: str):
        """Execute a scheduled task.
        
        Args:
            task_name: Name of the task to execute
        """
        task = self._tasks.get(task_name)
        handler = self._task_handlers.get(task_name)
        
        if not task or not handler:
            logger.warning(f"Task not found: {task_name}")
            return
        
        now = datetime.now()
        task.last_run = now
        task.next_run = now + timedelta(seconds=task.interval_seconds)
        
        logger.info(f"Executing scheduled task: {task_name}")
        
        try:
            await handler()
            task.run_count += 1
            logger.info(f"Task completed successfully: {task_name}")
        except Exception as e:
            task.error_count += 1
            logger.error(f"Task failed: {task_name} - {e}", exc_info=True)
    
    async def _create_partitions_task(self):
        """Task to create database partitions for upcoming months."""
        months_ahead = getattr(settings, 'TICK_PARTITION_MONTHS_AHEAD', 3)
        await self.create_partitions(months_ahead=months_ahead)
    
    async def _cleanup_old_data_task(self):
        """Task to clean up old tick data."""
        retention_days = settings.TICK_RETENTION_DAYS
        await self.cleanup_old_data(retention_days=retention_days)
    
    async def _integrity_check_task(self):
        """Task to run data integrity checks."""
        await self.run_integrity_check()
    
    async def create_partitions(self, months_ahead: int = 3) -> List[PartitionInfo]:
        """Create database partitions for upcoming months.
        
        Args:
            months_ahead: Number of months to create partitions for
            
        Returns:
            List of created partition info
        """
        created_partitions = []
        now = datetime.now()
        
        for i in range(months_ahead):
            target_date = now + timedelta(days=30 * i)
            year = target_date.year
            month = target_date.month
            
            # Calculate partition boundaries
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1)
            else:
                end_date = datetime(year, month + 1, 1)
            
            partition_name = f"ticks_y{year}m{month:02d}"
            
            try:
                # Check if partition already exists
                exists = await self._check_partition_exists(partition_name)
                if exists:
                    logger.debug(f"Partition already exists: {partition_name}")
                    continue
                
                # Create partition
                await self._create_partition(
                    partition_name=partition_name,
                    start_date=start_date,
                    end_date=end_date
                )
                
                created_partitions.append(PartitionInfo(
                    table_name="stock_tick_history",
                    partition_name=partition_name,
                    start_date=start_date,
                    end_date=end_date
                ))
                
                logger.info(f"Created partition: {partition_name} ({start_date.date()} to {end_date.date()})")
                
            except Exception as e:
                logger.error(f"Failed to create partition {partition_name}: {e}")
        
        return created_partitions
    
    async def _check_partition_exists(self, partition_name: str) -> bool:
        """Check if a partition already exists.
        
        Args:
            partition_name: Name of the partition
            
        Returns:
            True if partition exists
        """
        try:
            row = await Database.fetchrow(
                """
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = $1
                  AND c.relkind = 'r'
                """,
                partition_name
            )
            return row is not None
        except Exception as e:
            logger.error(f"Error checking partition existence: {e}")
            return False
    
    async def _create_partition(
        self, 
        partition_name: str, 
        start_date: datetime, 
        end_date: datetime
    ):
        """Create a single partition.
        
        Args:
            partition_name: Name for the partition
            start_date: Partition start date
            end_date: Partition end date
        """
        # Create partition SQL
        # Note: This is a simplified version; actual implementation depends on 
        # your PostgreSQL partitioning strategy
        sql = f"""
        CREATE TABLE IF NOT EXISTS {partition_name} (
            LIKE stock_tick_history INCLUDING ALL
        ) INHERITS (stock_tick_history);
        """
        
        # Add constraints
        constraint_sql = f"""
        ALTER TABLE {partition_name}
        ADD CONSTRAINT {partition_name}_tick_time_check
        CHECK (tick_time >= $1 AND tick_time < $2);
        """
        
        await Database.execute(sql)
        await Database.execute(constraint_sql, start_date, end_date)
    
    async def cleanup_old_data(self, retention_days: Optional[int] = None) -> CleanupResult:
        """Clean up old tick data based on retention policy.
        
        Args:
            retention_days: Number of days to retain (defaults to settings)
            
        Returns:
            Cleanup result statistics
        """
        if retention_days is None:
            retention_days = settings.TICK_RETENTION_DAYS
        
        start_time = datetime.now()
        cutoff_date = start_time - timedelta(days=retention_days)
        
        logger.info(f"Starting cleanup of tick data older than {cutoff_date.date()}")
        
        try:
            deleted_count = await tick_history_db.delete_old_ticks(cutoff_date)
            
            duration = (datetime.now() - start_time).total_seconds()
            
            result = CleanupResult(
                deleted_count=deleted_count,
                retention_days=retention_days,
                cutoff_date=cutoff_date,
                duration_seconds=duration
            )
            
            logger.info(
                f"Cleanup completed: {deleted_count} records deleted in {duration:.2f}s"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Cleanup failed: {e}", exc_info=True)
            return CleanupResult(
                retention_days=retention_days,
                cutoff_date=cutoff_date,
                duration_seconds=(datetime.now() - start_time).total_seconds()
            )
    
    async def run_integrity_check(
        self, 
        hours_back: int = 6,
        symbols: Optional[List[str]] = None
    ) -> IntegrityCheckResult:
        """Run data integrity checks.
        
        Args:
            hours_back: How many hours back to check
            symbols: Optional list of symbols to check (checks watchlist if None)
            
        Returns:
            Integrity check result
        """
        start_time = datetime.now()
        result = IntegrityCheckResult()
        
        try:
            end_time = start_time
            start_check_time = start_time - timedelta(hours=hours_back)
            
            # Get symbols to check
            if symbols is None:
                # Get symbols from watchlist
                rows = await Database.fetch(
                    """
                    SELECT DISTINCT symbol 
                    FROM watchlist_items 
                    WHERE market IN ('AShare', 'SSE', 'SZSE')
                    """
                )
                symbols = [r['symbol'] for r in rows]
            
            result.checked_symbols = len(symbols)
            logger.info(f"Running integrity check on {len(symbols)} symbols for last {hours_back} hours")
            
            for symbol in symbols:
                try:
                    # Check for data gaps
                    gaps = await self._check_data_gaps(symbol, start_check_time, end_time)
                    if gaps:
                        result.gap_periods.extend(gaps)
                        result.issues_found += len(gaps)
                    
                    # Check for missing data
                    count = await tick_history_db.get_ticks_count(
                        symbol, start_check_time, end_time
                    )
                    if count == 0:
                        result.missing_data_symbols.append(symbol)
                        result.issues_found += 1
                        
                except Exception as e:
                    logger.warning(f"Integrity check failed for {symbol}: {e}")
                    result.issues_found += 1
            
            result.duration_seconds = (datetime.now() - start_time).total_seconds()
            
            logger.info(
                f"Integrity check completed: {result.checked_symbols} symbols checked, "
                f"{result.issues_found} issues found in {result.duration_seconds:.2f}s"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Integrity check failed: {e}", exc_info=True)
            result.duration_seconds = (datetime.now() - start_time).total_seconds()
            return result
    
    async def _check_data_gaps(
        self, 
        symbol: str, 
        start_time: datetime, 
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """Check for data gaps in tick history.
        
        Args:
            symbol: Stock symbol
            start_time: Start of time range
            end_time: End of time range
            
        Returns:
            List of gap periods found
        """
        gaps = []
        
        try:
            # Get all ticks in range ordered by time
            ticks = await tick_history_db.get_ticks_by_time_range(
                symbol, start_time, end_time, limit=10000, offset=0
            )
            
            if len(ticks) < 2:
                return gaps
            
            # Check for gaps larger than expected (e.g., > 5 minutes during trading hours)
            max_gap_seconds = 300  # 5 minutes
            
            for i in range(1, len(ticks)):
                prev_time = ticks[i-1].get('tick_time')
                curr_time = ticks[i].get('tick_time')
                
                if isinstance(prev_time, str):
                    prev_time = datetime.fromisoformat(prev_time.replace('Z', '+00:00'))
                if isinstance(curr_time, str):
                    curr_time = datetime.fromisoformat(curr_time.replace('Z', '+00:00'))
                
                gap_seconds = (curr_time - prev_time).total_seconds()
                
                if gap_seconds > max_gap_seconds:
                    gaps.append({
                        'symbol': symbol,
                        'start': prev_time.isoformat(),
                        'end': curr_time.isoformat(),
                        'gap_seconds': gap_seconds,
                    })
            
            return gaps
            
        except Exception as e:
            logger.warning(f"Error checking data gaps for {symbol}: {e}")
            return []
    
    def get_task_status(self) -> Dict[str, Any]:
        """Get status of all scheduled tasks.
        
        Returns:
            Dictionary with task status information
        """
        return {
            name: {
                'enabled': task.enabled,
                'last_run': task.last_run.isoformat() if task.last_run else None,
                'next_run': task.next_run.isoformat() if task.next_run else None,
                'run_count': task.run_count,
                'error_count': task.error_count,
                'interval_seconds': task.interval_seconds,
            }
            for name, task in self._tasks.items()
        }
    
    async def run_task_now(self, task_name: str) -> bool:
        """Manually trigger a task to run immediately.
        
        Args:
            task_name: Name of the task to run
            
        Returns:
            True if task was executed
        """
        if task_name not in self._tasks:
            logger.warning(f"Task not found: {task_name}")
            return False
        
        await self._execute_task(task_name)
        return True


# Global scheduler instance
tick_scheduler = TickScheduler()


async def start_scheduler():
    """Convenience function to start the global scheduler."""
    await tick_scheduler.start()


async def stop_scheduler():
    """Convenience function to stop the global scheduler."""
    await tick_scheduler.stop()
