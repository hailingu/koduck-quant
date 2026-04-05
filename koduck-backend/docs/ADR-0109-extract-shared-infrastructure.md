# ADR-0109: 提取共享基础设施到 koduck-common 模块

- Status: Accepted
- Date: 2026-04-05
- Issue: #517

## Context

根据 ADR-0107 和 ADR-0108 的分析，当前项目存在循环依赖问题，阻碍了 portfolio 和 community 模块的代码迁移。

### 问题回顾

**循环依赖：**
```
koduck-portfolio → koduck-core (需要基础设施)
koduck-core → koduck-portfolio (需要 DTO/Entity)
```

**根本原因：**
- koduck-core 既包含业务逻辑，又包含共享基础设施
- 所有模块都依赖 koduck-core 获取基础设施
- 无法将业务代码从 koduck-core 迁出，因为其他模块需要这些代码

### 当前模块结构

```
koduck-common (基础工具类)
    ↑
koduck-core (业务逻辑 + 基础设施) ← 所有模块依赖
    ↑
koduck-portfolio/community (空壳，依赖 core)
```

## Decision

### 将共享基础设施从 koduck-core 提取到 koduck-common

**提取范围：**

1. **基础 DTO**
   - ApiResponse<T>: 统一 API 响应封装
   - PageResponse<T>: 分页响应封装
   - UserInfo: 用户信息 DTO

2. **安全基础设施**
   - AuthUserPrincipal: 认证用户主体
   - JwtTokenProvider 接口（如适用）

3. **Controller 支持**
   - AuthenticatedUserResolver: 认证用户解析器

4. **异常体系**
   - BusinessException: 业务异常基类
   - ErrorCode: 错误码枚举
   - GlobalExceptionHandler: 全局异常处理器

5. **配置属性**
   - 通用的配置属性类

### 目标模块结构

```
koduck-common (基础设施)
    ↑
koduck-core (业务逻辑) → koduck-portfolio/community
    ↑
koduck-portfolio/community (业务模块，依赖 common 而非 core)
```

### 迁移策略

1. **识别基础设施类**
   - 分析 koduck-core 中的类，识别被多个模块共享的基础设施

2. **迁移到 koduck-common**
   - 保持包路径不变（com.koduck.xxx）
   - 更新 koduck-common 的 pom.xml，添加必要依赖

3. **更新 koduck-core**
   - 删除已迁移的类
   - 从 koduck-common 导入

4. **验证依赖关系**
   - koduck-portfolio/community 可以直接依赖 koduck-common
   - 无需依赖 koduck-core 即可使用基础设施

## Consequences

### 正向影响

1. **消除循环依赖**: koduck-portfolio/community 可以独立存在
2. **真正的模块化**: 各模块职责清晰，依赖关系明确
3. **可测试性提升**: 模块可以独立测试，无需依赖整个 koduck-core
4. **代码复用**: 基础设施被明确分离，便于复用

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 类全名保持不变 |
| 功能兼容 | ✅ 无变化 | 仅文件位置调整 |
| 依赖关系 | ⚠️ 调整 | 模块依赖关系发生变化，需要验证 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 遗漏依赖 | 中 | 中 | 全面分析 koduck-core 的依赖关系 |
| 编译错误 | 中 | 中 | 仔细处理 import 语句 |
| 循环依赖仍存在 | 低 | 高 | 验证最终的依赖关系图 |

## Implementation

### 变更清单

1. **koduck-common 模块**
   - [ ] 创建 dto 包，迁移 ApiResponse, PageResponse, UserInfo
   - [ ] 创建 security 包，迁移 AuthUserPrincipal
   - [ ] 创建 controller/support 包，迁移 AuthenticatedUserResolver
   - [ ] 创建 exception 包，迁移基础异常类
   - [ ] 更新 pom.xml，添加必要依赖（Spring Security, Validation 等）

2. **koduck-core 模块**
   - [ ] 删除已迁移的基础设施类
   - [ ] 更新 import 语句
   - [ ] 确保 koduck-core 依赖 koduck-common

3. **koduck-portfolio/community 模块**
   - [ ] 验证可以通过 koduck-common 访问基础设施
   - [ ] 后续可以移除对 koduck-core 的依赖（Phase 3+）

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] 所有模块可以正常访问基础设施类
- [ ] 无循环依赖

### 后续工作

提取共享基础设施后，可以继续执行：
- Phase 3: 迁移 DTO 和 Entity（现在可以安全迁移）
- Phase 4: 迁移 Repository
- Phase 5: 迁移 Service 和 Controller

## References

- Issue: #517
- ADR-0107: 迁移 portfolio 和 community 代码到对应模块
- ADR-0108: Phase 2 - 记录 DTO/Entity 迁移的循环依赖问题
- 架构评估: ARCHITECTURE-EVALUATION.md
