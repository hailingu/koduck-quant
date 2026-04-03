# ADR-0045: DTO 层冗余类消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #382

## Context

根据 `docs/dto-redundancy-analysis.md` 分析报告，koduck-backend 的 DTO 层存在多处完全冗余的类，这些冗余增加了维护成本，违反了 DRY 原则。

### 发现的冗余问题

| 严重程度 | 冗余对象 | 原因 |
|---------|---------|------|
| 🔴 完全冗余 | `profile/UpdateProfileDTO` | 与 `UpdateProfileRequest` 字段完全相同，仅缺少验证注解 |
| 🔴 完全冗余 | `profile/ProfileResponse` | 是 `ProfileDTO` 的严格子集，缺少 location 和 website 字段 |
| 🔴 完全冗余 | `settings/UserSettingsDto` 与 `UpdateSettingsRequest` 的 7 个内部类 | 字段、类型、数量完全相同 |

## Decision

### 决策 1: 删除 `UpdateProfileDTO`，统一使用 `UpdateProfileRequest`

**理由**:
- 两者字段完全一致（nickname, phone, bio, location, website）
- `UpdateProfileRequest` 多了 `@Size` 验证注解，更适合作为 API 层输入
- `UpdateProfileRequest` 已用于 `ProfileController`，`UpdateProfileDTO` 仅用于 Service 层

**实施方案**:
- 删除 `UpdateProfileDTO.java`
- 修改 `ProfileService` 接口，将 `updateProfile` 方法参数改为 `UpdateProfileRequest`
- 修改 `ProfileServiceImpl` 实现类相应方法

### 决策 2: 删除 `ProfileResponse`，统一使用 `ProfileDTO`

**理由**:
- `ProfileResponse` 是 `ProfileDTO` 的严格子集（缺少 location 和 website）
- 统一使用 `ProfileDTO` 可以简化代码，同时保留完整信息
- `ProfileController` 当前返回空壳 stub，实际使用时会返回完整数据

**实施方案**:
- 删除 `ProfileResponse.java`
- 修改 `ProfileController`，将 `getProfile` 和 `updateProfile` 的返回类型改为 `ProfileDTO`

### 决策 3: 提取重复内部类为独立 DTO 类

**理由**:
- `UserSettingsDto` 和 `UpdateSettingsRequest` 包含 7 个完全相同的内部类
- 提取为独立类可以消除重复，提高可维护性
- 符合单一职责原则

**提取的类**:
1. `LlmConfigDto` - LLM 配置
2. `ProviderConfigDto` - 提供商配置
3. `MemoryConfigDto` - 记忆配置
4. `NotificationConfigDto` - 通知配置
5. `TradingConfigDto` - 交易配置
6. `DisplayConfigDto` - 显示配置
7. `QuickLinkDto` - 快捷链接

**实施方案**:
- 在 `dto/settings/` 包下创建 7 个新的独立 DTO 类
- 修改 `UserSettingsDto`，将内部类改为引用新类
- 修改 `UpdateSettingsRequest`，将内部类改为引用新类
- 更新所有使用这些内部类的文件（Mapper、Service、Support 类）

## Consequences

### 正向影响

- 消除代码重复，降低维护成本
- 简化 DTO 结构，提高可读性
- 统一 API 数据模型
- 符合 DRY 原则

### 消极影响

- 需要修改多处引用（Service、Controller、Mapper）
- 需要创建 7 个新的独立 DTO 文件
- 有一定的代码变更量

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 无 | `ProfileResponse` → `ProfileDTO` 字段更多，向后兼容 |
| Service 接口 | 有 | `ProfileService` 参数类型变更，需更新实现 |
| 序列化 | 无 | 字段名和类型保持不变 |
| 数据库 | 无 | 不涉及实体变更 |
| 测试 | 有 | 需要更新测试中的类型引用 |

## Related

- Issue #382
- `docs/dto-redundancy-analysis.md`
- ADR-0038: DTO Checkstyle 代码风格修复（Batch 3）
