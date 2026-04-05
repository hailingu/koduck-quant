# ADR-0110: 继续提取共享基础设施到 koduck-common

- Status: Accepted
- Date: 2026-04-05
- Issue: #519

## Context

根据 ADR-0109 的规划，继续提取 koduck-core 中的共享基础设施到 koduck-common 模块。

### ADR-0109 完成情况

已成功迁移：
- ApiResponse (统一 API 响应包装)
- ErrorCode (错误码枚举)

### 剩余待迁移的基础设施

**DTO 类：**
- UserInfo: 用户信息 DTO，被多个模块使用
- PageResponse: 分页响应封装

**异常类：**
- BusinessException: 业务异常基类
- ResourceNotFoundException: 资源不存在异常
- ValidationException: 验证异常

## Decision

### 继续提取共享基础设施到 koduck-common

**提取范围：**

1. **DTO 类**
   - UserInfo: 用户信息传输对象
   - PageResponse<T>: 通用分页响应封装

2. **异常类**
   - BusinessException: 业务异常基类，所有业务异常的父类
   - ResourceNotFoundException: 资源不存在异常
   - ValidationException: 参数验证异常

### 设计原则

参考 koduck-common/UserPrincipal.java 的设计模式：

1. **最小契约原则**: 定义最小的行为契约，避免过度设计
2. **向后兼容**: 保持类全名不变，确保现有代码无需修改
3. **无循环依赖**: 确保 koduck-common 不依赖 koduck-core
4. **接口优先**: 如适用，使用接口定义契约

### 迁移策略

1. **分析依赖**: 检查每个类的依赖关系，确保可以安全迁移
2. **复制文件**: 将文件复制到 koduck-common 的相同包路径
3. **更新依赖**: 如需要，更新 koduck-common 的 pom.xml
4. **删除原文件**: 从 koduck-core 删除已迁移的文件
5. **验证编译**: 确保所有模块编译通过

## Consequences

### 正向影响

1. **进一步模块化**: koduck-core 体积继续减小
2. **依赖清晰**: 共享基础设施明确归属 koduck-common
3. **为迁移铺路**: koduck-portfolio/community 可以依赖 common 而非 core

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 类全名保持不变 |
| 功能兼容 | ✅ 无变化 | 仅文件位置调整 |
| 依赖关系 | ✅ 优化 | 模块依赖关系更清晰 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 依赖遗漏 | 低 | 中 | 检查每个类的 import 语句 |
| 编译错误 | 低 | 中 | 充分测试编译 |

## Implementation

### 变更清单

1. **koduck-common 模块**
   - [x] 迁移 BusinessException.java
   - [x] 迁移 ResourceNotFoundException.java
   - [x] 迁移 ValidationException.java
   - [ ] ~~迁移 UserInfo.java~~（依赖 koduck-core 的 User 实体，无法迁移）
   - [ ] ~~迁移 PageResponse.java~~（文件不存在）

2. **koduck-core 模块**
   - [x] 删除已迁移的异常类

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [x] `mvn checkstyle:check` 无异常
- [x] 所有模块可以正常访问迁移的类

### 后续工作

继续提取其他共享类：
- GlobalExceptionHandler
- 其他通用工具类

最终目标是让 koduck-portfolio/community 可以只依赖 koduck-common，实现真正的模块化。

## References

- Issue: #519
- ADR-0107: 迁移 portfolio 和 community 代码到对应模块
- ADR-0108: Phase 2 - 记录 DTO/Entity 迁移的循环依赖问题
- ADR-0109: 提取共享基础设施到 koduck-common 模块
