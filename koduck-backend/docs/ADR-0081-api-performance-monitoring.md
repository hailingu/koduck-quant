# ADR-0081: API 响应时间监控和性能基线 CI 集成

- Status: Accepted
- Date: 2026-04-04
- Issue: #456

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的评估，项目存在以下可观测性问题：

| 问题 | 现状 | 影响 |
|------|------|------|
| 缺乏 API 响应时间监控 | 仅有基础 Actuator，无 Micrometer 指标 | 无法量化 API 性能 |
| 性能基线未集成 CI | `docs/perf-baseline.md` 完善但未自动化 | 性能退化无法及时发现 |
| 无性能回归检测 | 无自动化性能测试 | 代码变更可能引入性能问题 |

当前基础监控仅包含：
- `/actuator/health` - 健康检查
- `/actuator/info` - 应用信息

缺少：
- HTTP 请求处理时间统计（P50/P95/P99）
- JVM 指标（GC、内存、线程）
- 自定义业务指标
- 自动化性能测试

## Decision

### 1. 集成 Micrometer + Prometheus

添加依赖：
- `micrometer-registry-prometheus` - Prometheus 指标暴露
- `micrometer-core` - 核心指标收集

暴露端点：
- `/actuator/prometheus` - Prometheus 抓取端点

自动记录的指标：
- HTTP 请求处理时间（`http.server.requests`）
- JVM 内存使用
- GC 统计
- 线程池状态

### 2. 创建 K6 压测脚本

创建 `perf-tests/` 目录，包含：
- `health-api-test.js` - Health API 基础测试
- `market-quote-test.js` - 行情 API 测试
- `mixed-load-test.js` - 混合负载测试

### 3. 创建 GitHub Actions Workflow

创建 `.github/workflows/performance-test.yml`：
- 触发条件：每周一凌晨 2 点 + 手动触发
- 步骤：
  1. 启动依赖服务（PostgreSQL、Redis）
  2. 启动应用
  3. 执行 K6 压测
  4. 上传测试结果

### 4. 配置更新

`application.yml` 更新：
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  metrics:
    export:
      prometheus:
        enabled: true
    distribution:
      slo:
        http.server.requests: 50ms,100ms,200ms,500ms,1s,2s
```

## Consequences

### 正向影响

- **可观测性增强**：API 响应时间可量化，支持 P50/P95/P99 分析
- **性能回归保护**：自动化性能测试发现退化
- **容量规划支持**：基线数据支持扩容决策
- **故障排查**：指标数据辅助定位性能瓶颈

### 兼容性影响

- **无 API 变更**：新增 `/actuator/prometheus` 端点，不影响现有接口
- **依赖新增**：增加 Micrometer 相关依赖（~500KB）
- **资源占用**：指标收集占用少量内存和 CPU

## Alternatives Considered

1. **使用 Spring Boot Admin**
   - 拒绝：需要额外部署 Admin Server，增加运维复杂度
   - 当前方案：使用 Prometheus + Grafana，云原生标准方案

2. **使用 Datadog/NewRelic 等 SaaS**
   - 拒绝：需要付费，且数据需发送到外部
   - 当前方案：开源方案，数据可控

3. **仅添加 Micrometer，不集成 K6 CI**
   - 拒绝：仅监控无回归检测，无法防止性能退化
   - 当前方案：监控 + CI 压测双管齐下

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- `/actuator/prometheus` 端点可访问
- K6 压测脚本可执行
- GitHub Actions workflow 语法正确
