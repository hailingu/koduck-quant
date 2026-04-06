# Security 公开端点配置

## 背景

`SecurityConfig` 中公开端点（`permitAll`）策略已从硬编码迁移为配置外置，统一由 `koduck.security` 管理。

## 配置项

位于 `application.yml`：

- `koduck.security.permit-all-patterns`：所有 HTTP 方法可匿名访问的路径
- `koduck.security.permit-all-get-patterns`：仅 GET 可匿名访问的路径

默认配置与迁移前保持一致：

```yaml
koduck:
  security:
    permit-all-patterns:
      - /api/v1/auth/**
      - /actuator/health
      - /api/v1/health/**
      - /api/v1/monitoring/**
      - /ws/**
      - /api/v1/a-share/**
    permit-all-get-patterns:
      - /api/v1/market/**
```

## 使用建议

1. 新增公开接口时优先更新配置，不直接改 `SecurityConfig`。
2. 仅在明确需要“只读公开”场景时放入 `permit-all-get-patterns`。
3. 每次策略调整建议同步评审并更新 ADR/变更说明。
