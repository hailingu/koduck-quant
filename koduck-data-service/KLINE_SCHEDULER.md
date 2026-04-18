# K-line Scheduler 功能文档

## 功能概述

实现了自动定时更新 K-line 数据的完整方案，包括：
- 定时任务调度器（KlineScheduler）
- 文件锁机制（防止并发写入）
- 状态管理（初始化与运行时更新的协调）
- 数据库自动同步

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                     K-line Data Update Flow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Service Startup                                             │
│     │                                                           │
│     ▼                                                           │
│  2. KlineInitializer.run()                                      │
│     ├── 检查数据库表                                            │
│     ├── 从 CSV 导入历史数据                                     │
│     └── mark_initialization_complete() ───────┐                 │
│     │                                         │                 │
│     ▼                                         ▼                 │
│  3. KlineScheduler.start()           Scheduler State            │
│     ├── 等待初始化完成               INITIALIZING ──► IDLE      │
│     └── 启动后台任务                                            │
│     │                                                           │
│     ▼ (每小时检查一次)                                          │
│  4. _run_loop()                                                 │
│     ├── _should_update()? (交易日 15:35 后)                     │
│     ├── acquire csv_lock (non-blocking)                         │
│     ├── _update_symbol() (从 Eastmoney API)                     │
│     ├── write to CSV (locked)                                   │
│     └── _sync_to_database()                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 文件说明

### 核心服务

| 文件 | 说明 |
|------|------|
| `app/services/kline_scheduler.py` | 定时调度器，负责周期性地更新 K-line 数据 |
| `app/services/kline_file_lock.py` | 文件锁机制，防止并发写入 CSV |
| `app/services/kline_initializer.py` | 启动时从 CSV 导入数据到数据库 |
| `app/services/kline_sync.py` | CSV 到数据库的同步服务 |

### 脚本工具

| 文件 | 说明 |
|------|------|
| `app/scripts/update_kline_eastmoney.py` | 手动更新 CSV 并同步数据库 |
| `app/scripts/sync_kline_to_db.py` | 手动同步 CSV 到数据库 |

## 并发控制

### 文件锁使用

```python
from app.services.kline_file_lock import csv_lock

# 写入操作（排他锁）
with csv_lock("601012", "1D", blocking=False) as acquired:
    if acquired:
        # 安全地写入 CSV
        write_csv()
    else:
        logger.warning("CSV is locked, skipping")

# 读取操作（共享锁）
with csv_read_lock("601012", "1D"):
    # 安全地读取 CSV
    read_csv()
```

### 状态管理

```python
class SchedulerState(Enum):
    IDLE = "idle"               # 等待下次更新
    INITIALIZING = "initializing"  # 启动初始化中
    UPDATING = "updating"       # 运行时更新中
    ERROR = "error"             # 错误状态
```

## API 端点

### 查看调度器状态

```bash
GET /api/v1/a-share/kline/scheduler/status
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "state": "idle",
    "init_completed": true,
    "stats": {
      "last_check": "2025-03-08T15:30:00",
      "last_update": "2025-03-08T15:35:12",
      "updates_count": 10,
      "errors_count": 0
    },
    "config": {
      "check_interval": 3600,
      "update_time": "15:35:00",
      "timezone": "Asia/Shanghai"
    }
  }
}
```

## 运行配置

仓库已移除 root 级别的 Docker Compose 入口。调度器相关配置以进程环境变量为准：

```yaml
services:
  data-service:
    volumes:
      # 关键：可读写挂载，容器更新会同步到宿主机
      - ./koduck-data-service/data:/app/data
      - ./koduck-data-service/logs:/app/logs
    environment:
      # 时区设置（重要！）
      - TZ=Asia/Shanghai
      # 调度器配置
      - KLINE_CHECK_INTERVAL=3600  # 检查间隔（秒）
      - KLINE_UPDATE_TIME=15:35     # 每日更新时间
```

## 使用方式

### 1. 自动更新（推荐）

服务启动后自动运行：
- 启动时：从 CSV 导入历史数据到数据库
- 运行时：每小时检查一次，交易日 15:35 后自动更新

### 2. 手动更新

```bash
# 更新指定股票
cd koduck-data-service
python3 app/scripts/update_kline_eastmoney.py --symbol 601012

# 更新所有股票
python3 app/scripts/update_kline_eastmoney.py --all
```

### 3. 仅同步数据库

```bash
# 同步所有 CSV 到数据库
python3 app/scripts/sync_kline_to_db.py --all

# 同步指定股票
python3 app/scripts/sync_kline_to_db.py --symbol 601012
```

## 更新策略

### 定时更新逻辑

1. **检查间隔**：每小时检查一次
2. **更新时机**：交易日 15:35 后（收盘后 5 分钟）
3. **防重复**：同一天只更新一次
4. **周末跳过**：周六日不更新

### 数据源优先级

1. **Eastmoney API** (Primary)
   - Playwright 获取 Cookie
   - 数据完整（OHLCV + Amount）
   
2. **Tencent API** (Fallback)
   - 无需 Cookie
   - Amount 通过 OHLC 均价估算

## 故障排查

### 查看调度器状态

```bash
# 通过 API
curl http://localhost:8000/api/v1/a-share/kline/scheduler/status

# 查看日志
grep scheduler koduck-data-service/logs/*.log
```

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 调度器显示 "initializing" | 初始化未完成 | 等待 KlineInitializer 完成 |
| CSV 更新但数据库未更新 | 同步失败 | 检查数据库连接，手动运行 sync_kline_to_db.py |
| 文件锁超时 | 并发写入冲突 | 检查是否有其他进程占用 CSV |
| 更新失败 | Eastmoney API 问题 | 查看日志，检查 Cookie 刷新 |

## 生产环境建议

### 1. 备份策略

```bash
# 定期备份 CSV 数据
cron: 0 0 * * * tar -czf backup/kline-$(date +%Y%m%d).tar.gz koduck-data-service/data/kline/
```

### 2. 监控告警

- 调度器状态监控
- 更新失败告警
- CSV 与数据库不一致检测

### 3. 性能优化

- 大数据量时分批更新
- 使用数据库连接池
- 考虑使用 Redis 缓存热点数据
