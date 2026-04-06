# 性能基线文档

## 概述

本文档记录 koduck-backend 关键接口的性能基线，用于容量规划与性能回归检测。

**测试时间**: 2026-04-01  
**测试环境**:  
- CPU: Apple M3 Pro (11核)  
- 内存: 36GB  
- 数据库: PostgreSQL 16 (Docker)  
- 缓存: Redis 7 (Docker)  
- JVM: -Xms512m -Xmx1g  

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

### 实测数据 (2026-04-01)

以下数据基于本地 Docker 环境的实测结果，测试环境配置：
- **硬件**: Apple M3 Pro (11核), 36GB 内存
- **软件**: Java 23, Spring Boot 3.2.x, PostgreSQL 16, Redis 7
- **JVM**: `-Xms512m -Xmx1g`

#### 单接口实测基线

| 接口 | 端点 | RPS | P50 | P95 | P99 | 错误率 | 状态 |
|------|------|-----|-----|-----|-----|--------|------|
| Health | GET /api/health | 100 | 12ms | 28ms | 45ms | 0% | ✅ 通过 |
| Market Quote | GET /api/market/quote | 50 | 45ms | 89ms | 156ms | 0.02% | ✅ 通过 |
| Portfolio Summary | GET /api/v1/portfolio/summary | 30 | 125ms | 280ms | 425ms | 0.15% | ✅ 通过 |

**测试说明**:
- 测试时长: 每个接口持续 2-3 分钟稳定期
- 负载模式: 恒定 RPS，30秒线性升压，30秒线性降压
- 阈值标准: P95 < 500ms, 错误率 < 1%
- 完整记录见: [perf-test-run-2026-04-01.md](./phase3/perf-test-run-2026-04-01.md)

### 单接口压测结果 (目标/规划值)

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

## 实验复现

### 前置要求

| 工具 | 版本 | 安装命令 |
|------|------|----------|
| K6 | v0.49+ | `brew install k6` (macOS) |
| Docker | 20+ | Docker Desktop |
| Java | 23+ | SDKMan / Homebrew |
| Maven | 3.9+ | `brew install maven` |

### 快速开始

```bash
# 1. 启动依赖服务
docker-compose -f docker-compose.local.yml up -d postgres redis

# 2. 启动应用
cd koduck-backend
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 3. 运行压测 (新终端)
cd koduck-backend/perf-tests
./run-local-perf-test.sh
```

### 独立测试命令

```bash
# Health API 测试 - 验证环境
k6 run --env BASE_URL=http://localhost:8080 health-api-test.js

# 行情 API 测试 - 核心业务
k6 run --env BASE_URL=http://localhost:8080 market-quote-test.js

# 投资组合摘要 - 需认证
k6 run --env BASE_URL=http://localhost:8080 portfolio-summary-test.js

# 混合负载测试
k6 run --env BASE_URL=http://localhost:8080 mixed-load-test.js
```

### 测试参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | http://localhost:8080 | 被测服务地址 |
| `API_TOKEN` | (空) | JWT 认证令牌 |
| `K6_OUT` | (空) | 输出格式，如 `json=results.json` |

### 完整参数示例

```bash
# 输出 JSON 报告
k6 run \
  --env BASE_URL=http://localhost:8080 \
  --out json=perf-results/health-result.json \
  health-api-test.js

# 指定更高负载
k6 run \
  --env BASE_URL=http://localhost:8080 \
  --env RPS=200 \
  health-api-test.js
```

## 验收标准

- [x] 关键接口性能基线建立
- [x] 压测脚本可复现
- [x] 容量边界明确
- [x] 优化建议清单
- [x] CI 集成配置
- [x] 实际压测执行 (2026-04-01)
- [x] 基线数据验证
- [x] Micrometer + Prometheus 集成
- [x] GitHub Actions 性能测试 Workflow
- [x] API 响应时间自动监控

## 附录

### 测试数据

压测使用以下股票代码池:
- 000001.SZ (平安银行)
- 000002.SZ (万科A)
- 600000.SH (浦发银行)
- 600519.SH (贵州茅台)
- 300750.SZ (宁德时代)
