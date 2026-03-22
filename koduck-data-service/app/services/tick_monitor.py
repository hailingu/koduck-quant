"""Tick data monitoring and alerting system.

This module provides:
- Real-time monitoring of tick data collection
- Alert generation for anomalies and interruptions
- Data latency tracking
- Metrics collection and reporting
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import deque

from app.db import Database, tick_history_db
from app.config import settings

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertType(Enum):
    """Types of alerts."""
    DATA_GAP = "data_gap"
    COLLECTION_STOPPED = "collection_stopped"
    HIGH_LATENCY = "high_latency"
    LOW_VOLUME = "low_volume"
    DB_ERROR = "db_error"
    SYSTEM_ERROR = "system_error"


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    type: AlertType
    severity: AlertSeverity
    message: str
    symbol: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TickMetrics:
    """Metrics for tick data collection."""
    symbol: str
    last_tick_time: Optional[datetime] = None
    last_tick_price: Optional[float] = None
    tick_count_1h: int = 0
    tick_count_24h: int = 0
    avg_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    data_gaps_1h: int = 0
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class SystemMetrics:
    """System-wide tick collection metrics."""
    total_symbols: int = 0
    active_symbols: int = 0  # Symbols with recent ticks
    total_ticks_1h: int = 0
    total_ticks_24h: int = 0
    avg_collection_latency_ms: float = 0.0
    db_connection_status: str = "unknown"
    last_collection_time: Optional[datetime] = None
    alerts_active: int = 0
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class LatencyMeasurement:
    """Single latency measurement."""
    timestamp: datetime
    latency_ms: float
    symbol: str


class TickMonitor:
    """Monitor for tick data collection.
    
    Tracks data collection health, detects anomalies,
    and generates alerts for issues.
    """
    
    # Alert thresholds
    DEFAULT_MAX_LATENCY_MS = 5000  # 5 seconds
    DEFAULT_MAX_GAP_SECONDS = 300  # 5 minutes
    DEFAULT_MIN_TICKS_PER_HOUR = 10
    
    def __init__(self):
        self._running = False
        self._monitor_task: Optional[asyncio.Task] = None
        self._alerts: Dict[str, Alert] = {}
        self._symbol_metrics: Dict[str, TickMetrics] = {}
        self._system_metrics = SystemMetrics()
        self._latency_history: deque = deque(maxlen=1000)
        self._alert_handlers: List[Callable[[Alert], None]] = []
        self._check_interval_seconds = 60  # Check every minute
        
        # Configuration
        self.max_latency_ms = getattr(settings, 'TICK_MONITOR_MAX_LATENCY_MS', self.DEFAULT_MAX_LATENCY_MS)
        self.max_gap_seconds = getattr(settings, 'TICK_MONITOR_MAX_GAP_SECONDS', self.DEFAULT_MAX_GAP_SECONDS)
        self.min_ticks_per_hour = getattr(settings, 'TICK_MONITOR_MIN_TICKS_PER_HOUR', self.DEFAULT_MIN_TICKS_PER_HOUR)
    
    def add_alert_handler(self, handler: Callable[[Alert], None]):
        """Add an alert handler callback.
        
        Args:
            handler: Function to call when alert is generated
        """
        self._alert_handlers.append(handler)
    
    async def start(self):
        """Start the monitor."""
        if self._running:
            logger.warning("Monitor is already running")
            return
        
        self._running = True
        logger.info("Starting tick monitor...")
        
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Tick monitor started")
    
    async def stop(self):
        """Stop the monitor."""
        if not self._running:
            return
        
        self._running = False
        logger.info("Stopping tick monitor...")
        
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Tick monitor stopped")
    
    async def _monitor_loop(self):
        """Main monitoring loop."""
        while self._running:
            try:
                await self._run_health_checks()
                await asyncio.sleep(self._check_interval_seconds)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Monitor loop error: {e}", exc_info=True)
                await asyncio.sleep(self._check_interval_seconds)
    
    async def _run_health_checks(self):
        """Run all health checks."""
        try:
            # Update system metrics
            await self._update_system_metrics()
            
            # Check for data gaps and latency issues
            await self._check_symbol_health()
            
            # Check database connectivity
            await self._check_database_health()
            
        except Exception as e:
            logger.error(f"Health check error: {e}", exc_info=True)
            self._create_alert(
                AlertType.SYSTEM_ERROR,
                AlertSeverity.ERROR,
                f"Health check failed: {str(e)}",
                metadata={'error': str(e)}
            )
    
    async def _update_system_metrics(self):
        """Update system-wide metrics."""
        try:
            now = datetime.now()
            one_hour_ago = now - timedelta(hours=1)
            one_day_ago = now - timedelta(days=1)
            
            # Get symbol count from watchlist
            row = await Database.fetchrow(
                """
                SELECT COUNT(DISTINCT symbol) as count 
                FROM watchlist_items 
                WHERE market IN ('AShare', 'SSE', 'SZSE')
                """
            )
            self._system_metrics.total_symbols = row['count'] if row else 0
            
            # Get total tick counts
            # Note: This is a simplified query; actual implementation may need optimization
            row = await Database.fetchrow(
                """
                SELECT COUNT(*) as count 
                FROM stock_tick_history 
                WHERE tick_time >= $1
                """,
                one_hour_ago
            )
            self._system_metrics.total_ticks_1h = row['count'] if row else 0
            
            row = await Database.fetchrow(
                """
                SELECT COUNT(*) as count 
                FROM stock_tick_history 
                WHERE tick_time >= $1
                """,
                one_day_ago
            )
            self._system_metrics.total_ticks_24h = row['count'] if row else 0
            
            # Calculate average latency
            if self._latency_history:
                recent_latencies = [
                    m.latency_ms for m in self._latency_history 
                    if m.timestamp >= one_hour_ago
                ]
                if recent_latencies:
                    self._system_metrics.avg_collection_latency_ms = sum(recent_latencies) / len(recent_latencies)
            
            # Count active alerts
            self._system_metrics.alerts_active = sum(
                1 for a in self._alerts.values() if not a.resolved
            )
            
            self._system_metrics.updated_at = now
            
        except Exception as e:
            logger.error(f"Failed to update system metrics: {e}")
    
    async def _check_symbol_health(self):
        """Check health of individual symbols."""
        try:
            now = datetime.now()
            one_hour_ago = now - timedelta(hours=1)
            
            # Get symbols from watchlist
            rows = await Database.fetch(
                """
                SELECT DISTINCT symbol 
                FROM watchlist_items 
                WHERE market IN ('AShare', 'SSE', 'SZSE')
                """
            )
            symbols = [r['symbol'] for r in rows]
            
            active_symbols = 0
            
            for symbol in symbols:
                try:
                    # Get latest tick
                    latest_ticks = await tick_history_db.get_latest_ticks(symbol, limit=1)
                    
                    if not latest_ticks:
                        # No data for this symbol
                        if symbol not in self._symbol_metrics:
                            self._symbol_metrics[symbol] = TickMetrics(symbol=symbol)
                        continue
                    
                    latest = latest_ticks[0]
                    tick_time = latest.get('tick_time')
                    if isinstance(tick_time, str):
                        tick_time = datetime.fromisoformat(tick_time.replace('Z', '+00:00'))
                    
                    # Update metrics
                    metrics = self._symbol_metrics.get(symbol)
                    if not metrics:
                        metrics = TickMetrics(symbol=symbol)
                        self._symbol_metrics[symbol] = metrics
                    
                    metrics.last_tick_time = tick_time
                    metrics.last_tick_price = latest.get('price')
                    
                    # Count ticks in last hour
                    count_1h = await tick_history_db.get_ticks_count(symbol, one_hour_ago, now)
                    metrics.tick_count_1h = count_1h
                    
                    if count_1h > 0:
                        active_symbols += 1
                    
                    # Check for low volume
                    if count_1h < self.min_ticks_per_hour:
                        self._create_alert(
                            AlertType.LOW_VOLUME,
                            AlertSeverity.WARNING,
                            f"Low tick volume for {symbol}: {count_1h} ticks in last hour",
                            symbol=symbol,
                            metadata={'tick_count': count_1h, 'threshold': self.min_ticks_per_hour}
                        )
                    
                    # Check for data gap
                    if tick_time:
                        gap_seconds = (now - tick_time).total_seconds()
                        if gap_seconds > self.max_gap_seconds:
                            self._create_alert(
                                AlertType.DATA_GAP,
                                AlertSeverity.WARNING,
                                f"Data gap detected for {symbol}: {gap_seconds:.0f}s since last tick",
                                symbol=symbol,
                                metadata={'gap_seconds': gap_seconds, 'last_tick': tick_time.isoformat()}
                            )
                    
                    metrics.updated_at = now
                    
                except Exception as e:
                    logger.warning(f"Health check failed for {symbol}: {e}")
            
            self._system_metrics.active_symbols = active_symbols
            
        except Exception as e:
            logger.error(f"Symbol health check failed: {e}")
    
    async def _check_database_health(self):
        """Check database connectivity."""
        try:
            # Simple connectivity check
            await Database.fetchrow("SELECT 1")
            self._system_metrics.db_connection_status = "connected"
        except Exception as e:
            self._system_metrics.db_connection_status = "disconnected"
            self._create_alert(
                AlertType.DB_ERROR,
                AlertSeverity.CRITICAL,
                f"Database connectivity issue: {str(e)}",
                metadata={'error': str(e)}
            )
    
    def record_latency(self, symbol: str, latency_ms: float):
        """Record a latency measurement.
        
        Args:
            symbol: Stock symbol
            latency_ms: Latency in milliseconds
        """
        measurement = LatencyMeasurement(
            timestamp=datetime.now(),
            latency_ms=latency_ms,
            symbol=symbol
        )
        self._latency_history.append(measurement)
        
        # Update symbol metrics
        metrics = self._symbol_metrics.get(symbol)
        if not metrics:
            metrics = TickMetrics(symbol=symbol)
            self._symbol_metrics[symbol] = metrics
        
        # Calculate rolling average
        recent = [m.latency_ms for m in self._latency_history if m.symbol == symbol]
        if recent:
            metrics.avg_latency_ms = sum(recent) / len(recent)
            metrics.max_latency_ms = max(recent)
        
        # Check for high latency
        if latency_ms > self.max_latency_ms:
            self._create_alert(
                AlertType.HIGH_LATENCY,
                AlertSeverity.WARNING,
                f"High latency detected for {symbol}: {latency_ms:.0f}ms",
                symbol=symbol,
                metadata={'latency_ms': latency_ms, 'threshold': self.max_latency_ms}
            )
    
    def record_tick(self, symbol: str, price: float, timestamp: Optional[datetime] = None):
        """Record a tick for monitoring.
        
        Args:
            symbol: Stock symbol
            price: Tick price
            timestamp: Tick timestamp (defaults to now)
        """
        if timestamp is None:
            timestamp = datetime.now()
        
        self._system_metrics.last_collection_time = timestamp
        
        # Update symbol metrics
        metrics = self._symbol_metrics.get(symbol)
        if not metrics:
            metrics = TickMetrics(symbol=symbol)
            self._symbol_metrics[symbol] = metrics
        
        metrics.last_tick_time = timestamp
        metrics.last_tick_price = price
        metrics.updated_at = datetime.now()
    
    def _create_alert(
        self, 
        alert_type: AlertType, 
        severity: AlertSeverity, 
        message: str,
        symbol: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """Create and store an alert.
        
        Args:
            alert_type: Type of alert
            severity: Alert severity
            message: Alert message
            symbol: Related symbol (optional)
            metadata: Additional data (optional)
            
        Returns:
            Created alert
        """
        # Check for duplicate alerts (same type and symbol, not resolved)
        for existing in self._alerts.values():
            if (existing.type == alert_type and 
                existing.symbol == symbol and 
                not existing.resolved):
                # Duplicate alert exists, don't create new one
                return existing
        
        alert_id = f"{alert_type.value}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{symbol or 'system'}"
        
        alert = Alert(
            id=alert_id,
            type=alert_type,
            severity=severity,
            message=message,
            symbol=symbol,
            metadata=metadata or {}
        )
        
        self._alerts[alert_id] = alert
        
        logger.warning(f"Alert created: [{severity.value}] {message}")
        
        # Notify handlers
        for handler in self._alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"Alert handler error: {e}")
        
        return alert
    
    def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an alert.
        
        Args:
            alert_id: ID of the alert to resolve
            
        Returns:
            True if alert was found and resolved
        """
        alert = self._alerts.get(alert_id)
        if not alert:
            return False
        
        alert.resolved = True
        alert.resolved_at = datetime.now()
        logger.info(f"Alert resolved: {alert_id}")
        return True
    
    def get_active_alerts(
        self, 
        severity: Optional[AlertSeverity] = None,
        alert_type: Optional[AlertType] = None
    ) -> List[Alert]:
        """Get active (unresolved) alerts.
        
        Args:
            severity: Filter by severity (optional)
            alert_type: Filter by type (optional)
            
        Returns:
            List of matching alerts
        """
        alerts = [a for a in self._alerts.values() if not a.resolved]
        
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        if alert_type:
            alerts = [a for a in alerts if a.type == alert_type]
        
        return sorted(alerts, key=lambda a: a.timestamp, reverse=True)
    
    def get_symbol_metrics(self, symbol: str) -> Optional[TickMetrics]:
        """Get metrics for a specific symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Metrics or None if not found
        """
        return self._symbol_metrics.get(symbol)
    
    def get_all_symbol_metrics(self) -> Dict[str, TickMetrics]:
        """Get metrics for all symbols.
        
        Returns:
            Dictionary of symbol -> metrics
        """
        return dict(self._symbol_metrics)
    
    def get_system_metrics(self) -> SystemMetrics:
        """Get system-wide metrics.
        
        Returns:
            System metrics
        """
        return self._system_metrics
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get a summary of all metrics.
        
        Returns:
            Metrics summary dictionary
        """
        return {
            'system': {
                'total_symbols': self._system_metrics.total_symbols,
                'active_symbols': self._system_metrics.active_symbols,
                'total_ticks_1h': self._system_metrics.total_ticks_1h,
                'total_ticks_24h': self._system_metrics.total_ticks_24h,
                'avg_latency_ms': round(self._system_metrics.avg_collection_latency_ms, 2),
                'db_status': self._system_metrics.db_connection_status,
                'alerts_active': self._system_metrics.alerts_active,
                'updated_at': self._system_metrics.updated_at.isoformat(),
            },
            'alerts': {
                'active': len(self.get_active_alerts()),
                'critical': len(self.get_active_alerts(severity=AlertSeverity.CRITICAL)),
                'error': len(self.get_active_alerts(severity=AlertSeverity.ERROR)),
                'warning': len(self.get_active_alerts(severity=AlertSeverity.WARNING)),
            },
            'collection': {
                'last_collection_time': self._system_metrics.last_collection_time.isoformat() 
                    if self._system_metrics.last_collection_time else None,
                'monitored_symbols': len(self._symbol_metrics),
            }
        }


# Global monitor instance
tick_monitor = TickMonitor()


async def start_monitor():
    """Convenience function to start the global monitor."""
    await tick_monitor.start()


async def stop_monitor():
    """Convenience function to stop the global monitor."""
    await tick_monitor.stop()


def record_tick_latency(symbol: str, latency_ms: float):
    """Record latency for a tick (convenience function)."""
    tick_monitor.record_latency(symbol, latency_ms)


def record_tick(symbol: str, price: float, timestamp: Optional[datetime] = None):
    """Record a tick (convenience function)."""
    tick_monitor.record_tick(symbol, price, timestamp)
