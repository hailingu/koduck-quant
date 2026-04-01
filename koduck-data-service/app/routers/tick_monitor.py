"""API routes for tick data monitoring and management."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.tick_monitor import tick_monitor, AlertSeverity, AlertType
from app.services.tick_scheduler import tick_scheduler, CleanupResult, IntegrityCheckResult
from app.services.tick_redis_cache import tick_redis_cache
from app.services.tick_history_service import tick_history_service
from app.services.data_updater import data_updater
from app.config import settings

router = APIRouter(prefix="/tick", tags=["tick-monitoring"])


# Pydantic models
class AlertResponse(BaseModel):
    id: str
    type: str
    severity: str
    message: str
    symbol: Optional[str] = None
    timestamp: str
    resolved: bool
    resolved_at: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class MetricsResponse(BaseModel):
    system: dict
    alerts: dict
    collection: dict


class TaskStatusResponse(BaseModel):
    name: str
    enabled: bool
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    run_count: int
    error_count: int
    interval_seconds: int


class ExportRequest(BaseModel):
    symbols: List[str]
    hours: int = Field(default=1, ge=1, le=24)


class ExportResponse(BaseModel):
    data: list
    metadata: dict


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    database: str
    cache: str
    scheduler: str
    monitor: str


@router.get("/health", response_model=HealthResponse)
async def get_health_status():
    """Get overall health status of tick data system."""
    return HealthResponse(
        status="healthy" if settings.TICK_HISTORY_ENABLED else "disabled",
        timestamp=datetime.now().isoformat(),
        database=tick_monitor.get_system_metrics().db_connection_status,
        cache="connected" if tick_redis_cache._connected else "disconnected",
        scheduler="running" if tick_scheduler._running else "stopped",
        monitor="running" if tick_monitor._running else "stopped",
    )


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Get comprehensive metrics summary."""
    return tick_monitor.get_metrics_summary()


@router.get("/metrics/system")
async def get_system_metrics():
    """Get system-wide metrics."""
    metrics = tick_monitor.get_system_metrics()
    return {
        'total_symbols': metrics.total_symbols,
        'active_symbols': metrics.active_symbols,
        'total_ticks_1h': metrics.total_ticks_1h,
        'total_ticks_24h': metrics.total_ticks_24h,
        'avg_collection_latency_ms': round(metrics.avg_collection_latency_ms, 2),
        'db_connection_status': metrics.db_connection_status,
        'alerts_active': metrics.alerts_active,
        'updated_at': metrics.updated_at.isoformat(),
    }


@router.get("/metrics/symbol/{symbol}")
async def get_symbol_metrics(symbol: str):
    """Get metrics for a specific symbol."""
    metrics = tick_monitor.get_symbol_metrics(symbol)
    if not metrics:
        raise HTTPException(status_code=404, detail=f"No metrics found for {symbol}")
    
    return {
        'symbol': metrics.symbol,
        'last_tick_time': metrics.last_tick_time.isoformat() if metrics.last_tick_time else None,
        'last_tick_price': metrics.last_tick_price,
        'tick_count_1h': metrics.tick_count_1h,
        'tick_count_24h': metrics.tick_count_24h,
        'avg_latency_ms': round(metrics.avg_latency_ms, 2),
        'max_latency_ms': round(metrics.max_latency_ms, 2),
        'data_gaps_1h': metrics.data_gaps_1h,
        'updated_at': metrics.updated_at.isoformat(),
    }


@router.get("/metrics/symbols")
async def get_all_symbol_metrics(
    limit: int = Query(default=100, ge=1, le=1000),
    active_only: bool = Query(default=False)
):
    """Get metrics for all symbols."""
    all_metrics = tick_monitor.get_all_symbol_metrics()
    
    metrics_list = []
    for symbol, metrics in all_metrics.items():
        # Filter active only
        if active_only and metrics.tick_count_1h == 0:
            continue
        
        metrics_list.append({
            'symbol': symbol,
            'last_tick_time': metrics.last_tick_time.isoformat() if metrics.last_tick_time else None,
            'tick_count_1h': metrics.tick_count_1h,
            'avg_latency_ms': round(metrics.avg_latency_ms, 2),
        })
    
    # Sort by tick count descending
    metrics_list.sort(key=lambda x: x['tick_count_1h'], reverse=True)
    
    return {
        'total': len(metrics_list),
        'metrics': metrics_list[:limit]
    }


@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    severity: Optional[str] = Query(default=None, enum=["info", "warning", "error", "critical"]),
    alert_type: Optional[str] = Query(default=None, enum=["data_gap", "collection_stopped", "high_latency", "low_volume", "db_error", "system_error"]),
    include_resolved: bool = Query(default=False)
):
    """Get active alerts with optional filtering."""
    severity_enum = AlertSeverity(severity) if severity else None
    type_enum = AlertType(alert_type) if alert_type else None
    
    alerts = tick_monitor.get_active_alerts(severity=severity_enum, alert_type=type_enum)
    
    if include_resolved:
        # Get all alerts including resolved
        all_alerts = list(tick_monitor._alerts.values())
        if severity_enum:
            all_alerts = [a for a in all_alerts if a.severity == severity_enum]
        if type_enum:
            all_alerts = [a for a in all_alerts if a.type == type_enum]
        alerts = all_alerts
    
    return [
        AlertResponse(
            id=a.id,
            type=a.type.value,
            severity=a.severity.value,
            message=a.message,
            symbol=a.symbol,
            timestamp=a.timestamp.isoformat(),
            resolved=a.resolved,
            resolved_at=a.resolved_at.isoformat() if a.resolved_at else None,
            metadata=a.metadata
        )
        for a in sorted(alerts, key=lambda x: x.timestamp, reverse=True)
    ]


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an alert."""
    success = tick_monitor.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "message": f"Alert {alert_id} resolved"}


@router.get("/scheduler/tasks", response_model=List[TaskStatusResponse])
async def get_scheduler_tasks():
    """Get status of all scheduled tasks."""
    tasks = tick_scheduler.get_task_status()
    return [
        TaskStatusResponse(
            name=name,
            enabled=status['enabled'],
            last_run=status['last_run'],
            next_run=status['next_run'],
            run_count=status['run_count'],
            error_count=status['error_count'],
            interval_seconds=status['interval_seconds']
        )
        for name, status in tasks.items()
    ]


@router.post("/scheduler/tasks/{task_name}/run")
async def run_task_now(task_name: str, background_tasks: BackgroundTasks):
    """Manually trigger a scheduled task."""
    valid_tasks = ['create_partitions', 'cleanup_old_data', 'integrity_check']
    if task_name not in valid_tasks:
        raise HTTPException(status_code=400, detail=f"Invalid task name. Valid: {valid_tasks}")
    
    background_tasks.add_task(tick_scheduler.run_task_now, task_name)
    return {"success": True, "message": f"Task {task_name} started in background"}


@router.post("/maintenance/cleanup")
async def run_cleanup(
    retention_days: Optional[int] = Query(default=None, ge=1, le=365),
    background: bool = Query(default=False)
):
    """Run data cleanup."""
    if background:
        from app.services.tick_scheduler import CleanupResult
        return {"success": True, "message": "Cleanup started in background"}
    
    result = await tick_scheduler.cleanup_old_data(retention_days)
    return {
        'deleted_count': result.deleted_count,
        'retention_days': result.retention_days,
        'cutoff_date': result.cutoff_date.isoformat() if result.cutoff_date else None,
        'duration_seconds': result.duration_seconds
    }


@router.post("/maintenance/integrity-check")
async def run_integrity_check(
    hours: int = Query(default=6, ge=1, le=72),
    background: bool = Query(default=False)
):
    """Run data integrity check."""
    if background:
        return {"success": True, "message": "Integrity check started in background"}
    
    result = await tick_scheduler.run_integrity_check(hours_back=hours)
    return {
        'checked_symbols': result.checked_symbols,
        'issues_found': result.issues_found,
        'missing_data_symbols': result.missing_data_symbols,
        'gap_periods': result.gap_periods,
        'duration_seconds': result.duration_seconds
    }


@router.post("/maintenance/partitions")
async def create_partitions(months_ahead: int = Query(default=3, ge=1, le=12)):
    """Create database partitions for upcoming months."""
    partitions = await tick_scheduler.create_partitions(months_ahead=months_ahead)
    return {
        'created': len(partitions),
        'partitions': [
            {
                'table_name': p.table_name,
                'partition_name': p.partition_name,
                'start_date': p.start_date.isoformat(),
                'end_date': p.end_date.isoformat()
            }
            for p in partitions
        ]
    }


@router.post("/export", response_model=ExportResponse)
async def export_ticks(request: ExportRequest):
    """Export tick data for specified symbols."""
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=request.hours)
    
    result = await tick_history_service.export_ticks_for_java_backend(
        symbols=request.symbols,
        start_time=start_time,
        end_time=end_time
    )
    
    return ExportResponse(
        data=result['data'],
        metadata=result['metadata']
    )


@router.get("/export/batch/{batch_id}")
async def get_export_batch(batch_id: str):
    """Get a cached export batch."""
    data = await tick_redis_cache.get_batch_for_export(batch_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Batch not found or expired")
    return {"batch_id": batch_id, "data": data}


@router.get("/cache/stats")
async def get_cache_stats():
    """Get Redis cache statistics."""
    return await tick_redis_cache.get_cache_stats()


@router.post("/cache/invalidate")
async def invalidate_cache(symbol: Optional[str] = None):
    """Invalidate cache for a symbol or all symbols."""
    if symbol:
        success = await tick_redis_cache.invalidate_symbol(symbol)
    else:
        success = await tick_redis_cache.invalidate_all()
    
    return {"success": success}


@router.get("/health/detailed")
async def get_detailed_health(
    hours: int = Query(default=24, ge=1, le=168)
):
    """Get detailed health report."""
    health = await tick_history_service.get_collection_health(hours=hours)
    metrics = tick_monitor.get_metrics_summary()
    
    return {
        'health': health,
        'metrics': metrics,
        'config': {
            'tick_history_enabled': settings.TICK_HISTORY_ENABLED,
            'tick_retention_days': settings.TICK_RETENTION_DAYS,
            'tick_batch_size': settings.TICK_BATCH_SIZE,
            'tick_monitor_enabled': getattr(settings, 'TICK_MONITOR_ENABLED', True),
        }
    }


@router.get("/symbols/{symbol}/volume-summary")
async def get_volume_summary(symbol: str, days: int = Query(default=7, ge=1, le=30)):
    """Get volume summary for a symbol."""
    return await tick_history_service.get_tick_volume_summary(symbol, days)


@router.get("/symbols/{symbol}/ticks")
async def get_symbol_ticks(
    symbol: str,
    hours: int = Query(default=1, ge=1, le=24),
    limit: int = Query(default=1000, ge=1, le=10000)
):
    """Get tick data for a symbol."""
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    result = await tick_history_service.get_ticks(
        symbol=symbol,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )
    
    return {
        'symbol': symbol,
        'data': result.data,
        'total': result.total,
        'page': result.page,
        'has_more': result.has_more
    }


@router.get("/search/price-range")
async def search_by_price_range(
    symbol: str,
    min_price: float,
    max_price: float,
    hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=1000, ge=1, le=5000)
):
    """Search ticks within a price range."""
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    ticks = await tick_history_service.search_ticks_by_price_range(
        symbol=symbol,
        min_price=min_price,
        max_price=max_price,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )
    
    return {
        'symbol': symbol,
        'min_price': min_price,
        'max_price': max_price,
        'count': len(ticks),
        'ticks': ticks
    }


@router.get("/buffer/status")
async def get_buffer_status():
    """Get data updater buffer status."""
    return {
        'buffer_size': len(data_updater._tick_buffer),
        'batch_size': settings.TICK_BATCH_SIZE,
        'update_count': data_updater._update_count,
        'tick_history_count': data_updater._tick_history_count,
    }


@router.post("/buffer/flush")
async def flush_buffer():
    """Flush the tick buffer to database."""
    success_count, fail_count = await data_updater.flush_remaining_ticks()
    return {
        'success': success_count,
        'failed': fail_count,
        'total': success_count + fail_count
    }
