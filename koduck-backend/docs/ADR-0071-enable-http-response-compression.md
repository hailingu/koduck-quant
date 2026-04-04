# ADR-0071: 启用 HTTP 响应压缩（Gzip）

- Status: Accepted
- Date: 2026-04-04
- Issue: #436

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的工程可行性评估，`koduck-backend` 当前缺少 HTTP 响应压缩配置。

KODUCK-QUANT 作为量化系统，后端 API 频繁返回大量文本数据：
- **K 线数据**：包含大量 OHLCV 的 JSON 数组
- **市场数据**：股票列表、实时行情、估值数据
- **回测结果**：交易记录、权益曲线等长列表
- **AI 分析**：长文本分析结果

未启用压缩时，这些数据以原始 JSON/XML/文本形式传输，导致：
- **带宽消耗高**：JSON 文本冗余度大
- **前端加载延迟大**：尤其在弱网环境下明显
- **移动端流量成本高**：量化研究者常通过移动端查看数据

## Decision

### 1. 在 Spring Boot 内嵌 Tomcat 中启用响应压缩

Spring Boot 原生支持通过 `server.compression.*` 配置开启 Tomcat 的 Gzip 压缩，无需引入额外依赖。

在 `application.yml`（通用配置）中增加：
```yaml
server:
  compression:
    enabled: true
    mime-types: text/html,text/xml,text/plain,text/css,text/javascript,application/javascript,application/json,application/xml
    min-response-size: 2048
```

### 2. 生产配置继承并保持一致

`application-prod.yml` 当前仅配置了 `server.port`，为明确生产环境行为并避免未来 prod 覆盖导致压缩丢失，在 `application-prod.yml` 中也显式保留压缩配置（与通用配置一致，或显式继承）。

**最终方案**：`application-prod.yml` 补充相同的 `server.compression` 配置块，确保生产环境明确启用。

### 3. 配置参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `enabled` | `true` | 开启响应压缩 |
| `mime-types` | `text/html,text/xml,text/plain,text/css,text/javascript,application/javascript,application/json,application/xml` | 覆盖项目核心 MIME 类型，确保 JSON 和 XML API 被压缩 |
| `min-response-size` | `2048` | 仅压缩大于 2KB 的响应，避免小响应因压缩头反而变大 |

### 4. 添加配置加载测试

新增（或更新现有）Spring Boot 配置属性测试，验证 `ServerProperties` 能正确解析压缩参数，确保配置格式有效且被 Spring Boot 识别。

## Consequences

### 正向影响

- **降低带宽消耗**：JSON 文本通常可压缩 60%~80%
- **减少前端加载时间**：API 响应体积显著缩小
- **提升移动端体验**：流量敏感场景收益明显
- **零代码侵入**：纯配置变更，不影响任何业务逻辑
- **无需外部依赖**：利用 Spring Boot + 内嵌 Tomcat 原生能力

### 兼容性影响

- **API 行为完全不变**：仅增加 `Content-Encoding: gzip` 响应头，数据内容一致
- **客户端兼容**：所有现代浏览器和 HTTP 客户端均支持 Gzip
- **CPU 开销极小**：Tomcat 的压缩实现成熟，对于 2KB 以上响应，压缩 CPU 开销远低于网络传输收益
- **无数据库或 DTO 变更**：纯基础设施层优化

## Alternatives Considered

1. **在 Nginx/网关层统一配置压缩**
   - 拒绝：当前项目直接暴露 Spring Boot 服务（本地开发和容器环境均如此），且不是所有环境都前置 Nginx；在服务层配置可保证所有环境一致受益
   - 当前方案：Spring Boot 原生压缩配置

2. **使用 Brotli 替代 Gzip**
   - 拒绝：Spring Boot 内嵌 Tomcat 对 Brotli 的支持需要额外配置和依赖（如 `brotli4j`），收益与复杂度不成正比
   - 当前方案：使用 Tomcat 原生 Gzip，后续如需 Brotli 可独立升级

3. **保持现状**
   - 拒绝：缺少压缩已被架构评估明确列为问题，且开启压缩是零风险、高收益的标准做法
   - 当前方案：立即启用压缩

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 新增/更新配置测试通过，验证 `server.compression.enabled=true` 被正确解析
