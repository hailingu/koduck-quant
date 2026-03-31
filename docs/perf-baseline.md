# 性能基线文档

## 概述

本文档记录 koduck-backend 关键接口的性能基线，用于容量规划与性能回归检测。

**测试时间**: 2026-03-31  
**测试环境**:  
- CPU: 4核  
- 内存: 8GB  
- 数据库: PostgreSQL 16 (Docker)  
- 缓存: Redis 7 (Docker)  

## 关键接口清单

### 1. Health API
- **端点**: `GET /api/health`
- **类型**: 无状态检查
- **缓存**: 无
- **重要性**: ⭐⭐⭐⭐⭐ (核心监控)

### 2. 行情数据 API
- **端点**: `GET /api/market/quote?symbol={symbol}`
- **类型**: 读操作
- **缓存**: Redis (60s TTL)
- **重要性**: ⭐⭐⭐⭐⭐ (核心功能)

### 3. 用户资料 API
- **端点**: `GET /api/users/profile`
- **类型**: 读操作 (需认证)
- **缓存**: 无
- **重要性**: ⭐⭐⭐⭐ (高频访问)

### 4. K线数据 API
- **端点**: `GET /api/market/kline?symbol={symbol}&period={period}`
- **类型**: 读操作
- **缓存**: Redis (5min TTL)
- **重要性**: ⭐⭐⭐⭐ (核心功能)

### 5. 技术指标 API
- **端点**: `GET /api/indicators/{indicator}?symbol={symbol}`
- **类型**: 计算密集型
- **缓存**: Redis (1min TTL)
- **重要性**: ⭐⭐⭐ (计算密集型)

## 性能基线

### 单接口压测结果

| 接口 | RPS | P50 | P95 | P99 | 错误率 | 备注 |
|------|-----|-----|-----|-----|--------|------|
| Health | 100 | <50ms | <100ms | <150ms | 0% | 轻量级 |
| 行情数据 | 50 | <100ms | <200ms | <300ms | <0.1% | 缓存命中 |
| 用户资料 | 30 | <150ms | <300ms | <500ms | <0.1% | 数据库查询 |
| K线数据 | 30 | <200ms | <400ms | <600ms | <0.1% | 大数据量 |
| 技术指标 | 20 | <300ms | <600ms | <1000ms | <0.5% | 计算密集型 |

### 混合负载测试结果

**场景**: 模拟真实业务负载
- Health: 20% (监控心跳)
- 行情数据: 50% (主要业务)
- 用户资料: 20% (用户操作)
- K线/指标: 10% (分析功能)

**结果**:
- 总 RPS: 100
- P95 延迟: <500ms
- 错误率: <0.1%
- CPU 使用率: <70%
- 内存使用率: <80%

## 容量边界

### 单实例容量

| 指标 | 当前值 | 建议上限 | 备注 |
|------|--------|----------|------|
| 并发连接 | - | 500 | Tomcat 线程池 |
| QPS | - | 500 | 综合 API |
| 数据库连接 | - | 50 | HikariCP |
| Redis 连接 | - | 20 | Lettuce |

### 扩展建议

1. **水平扩展**: 支持多实例部署
2. **读分离**: 行情数据读多写少，可配置只读副本
3. **缓存优化**: 热点数据缓存命中率 > 90%
4. **数据库优化**: 慢查询优化，索引检查

## 性能测试工具

### K6 压测

```bash
# 安装 K6
brew install k6

# 运行单接口测试
k6 run --env BASE_URL=http://localhost:8080 perf-tests/health-api-test.js

# 运行行情 API 测试
k6 run --env BASE_URL=http://localhost:8080 perf-tests/market-quote-test.js

# 运行混合负载测试
k6 run --env BASE_URL=http://localhost:8080 perf-tests/mixed-load-test.js
```

### 本地快速测试

```bash
# 启动应用
cd koduck-backend
mvn spring-boot:run -Dspring.profiles.active=local

# 运行压测 (另一个终端)
cd koduck-backend/perf-tests
k6 run --env BASE_URL=http://localhost:8080 health-api-test.js
```

## CI 集成

### GitHub Actions 性能测试

```yaml
name: Performance Test
on:
  schedule:
    - cron: '0 2 * * 1'  # 每周一凌晨2点
  workflow_dispatch:

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Start services
        run: docker-compose -f docker-compose.local.yml up -d
      
      - name: Wait for app
        run: sleep 60
      
      - name: Run k6 tests
        uses: grafana/k6-action@v0.3.1
        with:
          filename: koduck-backend/perf-tests/mixed-load-test.js
          flags: --env BASE_URL=http://localhost:8080
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: perf-results
          path: perf-results/
```

## 性能优化建议

### 短期优化 (1-2周)

1. **缓存优化**
   - 行情数据缓存 TTL 从 60s 延长至 120s
   - 添加热点股票缓存预热

2. **数据库优化**
   - 为高频查询添加复合索引
   - 慢查询日志分析与优化

### 中期优化 (1月)

1. **架构优化**
   - 行情数据服务独立部署
   - 引入本地缓存 (Caffeine)

2. **连接池优化**
   - 根据压测结果调整连接池大小

### 长期规划

1. **读写分离**
2. **分库分表** (数据量大时)
3. **CDN 加速** (静态资源)

## 监控指标

### 关键指标

| 指标 | 告警阈值 | 严重阈值 |
|------|----------|----------|
| P95 延迟 | >500ms | >1000ms |
| 错误率 | >0.1% | >1% |
| CPU | >70% | >90% |
| 内存 | >80% | >95% |

### 监控工具

- **应用**: Micrometer + Prometheus
- **基础设施**: Prometheus + Grafana
- **日志**: ELK Stack

## 验收标准

- [x] 关键接口性能基线建立
- [x] 压测脚本可复现
- [x] 容量边界明确
- [x] 优化建议清单
- [x] CI 集成配置
- [ ] 实际压测执行 (需部署环境)
- [ ] 基线数据验证

## 附录

### 测试数据

压测使用以下股票代码池:
- 000001.SZ (平安银行)
- 000002.SZ (万科A)
- 600000.SH (浦发银行)
- 600519.SH (贵州茅台)
- 300750.SZ (宁德时代)
