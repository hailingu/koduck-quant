# API Changelog

本文件用于记录后端 API 的历史变更，作为客户端升级、联调回归与版本评审的统一依据。

## 维护规则

- 所有对外 API 变更（新增、修改、废弃、移除）必须同步记录。
- 每次记录以日期 + 版本分组，建议与发布节奏一致。
- 变更项应明确影响范围、兼容性级别与迁移建议。
- 涉及不兼容变更时，必须关联对应 ADR 与迁移窗口。

## 变更分类

- `Added`: 新增接口或新增非破坏性字段
- `Changed`: 行为、语义或默认值变化（需说明兼容性）
- `Deprecated`: 标记废弃，保留过渡窗口
- `Removed`: 已移除能力（必须给出替代方案）
- `Fixed`: 向后兼容的缺陷修复
- `Security`: 认证鉴权、密钥、安全策略相关变更

## 记录模板

```markdown
## [vX.Y.Z] - YYYY-MM-DD

### Added
- `GET /api/v1/example`: 新增用途说明。（Impact: low）

### Changed
- `POST /api/v1/example`: 默认参数 `foo` 从 `A` 改为 `B`。（Impact: medium, Compatible: yes）

### Deprecated
- `GET /api/v1/legacy`: 标记为废弃，计划在 `vX+1.0.0` 移除。（Migration: 使用 `/api/v2/new`）

### Removed
- 移除 `GET /api/v1/old`。（Migration: 使用 `GET /api/v2/new`）

### Fixed
- 修复 `GET /api/v1/items` 在空分页参数时返回 500 的问题，改为 400。

### Security
- `/api/v1/auth/*` 接口强化 token 校验，拒绝弱签名算法。
```

## Changelog

## [v0.1.0] - 2026-04-02

### Added
- 建立 API Changelog 机制文档，统一 API 历史变更记录方式。

### Changed
- 无。

### Deprecated
- 无。

### Removed
- 无。

### Fixed
- 无。

### Security
- 无。
