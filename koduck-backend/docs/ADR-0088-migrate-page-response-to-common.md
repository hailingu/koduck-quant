# ADR-0088: 迁移 PageResponse 到 koduck-common 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #470

## Context

PageResponse 是一个通用的分页响应 DTO，用于封装分页查询结果。目前位于 koduck-core 模块，但被多个业务领域共享：

- Market 模块使用 PageResponse 返回股票列表
- Portfolio 模块使用 PageResponse 返回持仓列表
- Credential 模块使用 PageResponse 返回凭证列表
- Community 模块使用 PageResponse 返回信号列表

根据模块拆分原则，被多个领域共享的通用 DTO 应该下沉到 koduck-common 模块。

## Decision

将 PageResponse 从 koduck-core 迁移到 koduck-common 模块。

### 迁移内容

| 文件 | 原位置 | 新位置 |
|------|--------|--------|
| PageResponse.java | koduck-core/src/main/java/com/koduck/dto/common/ | koduck-common/src/main/java/com/koduck/dto/common/ |

### 依赖分析

PageResponse 依赖：
- `com.koduck.util.CollectionCopyUtils` - 已在 koduck-common 中 ✅
- `lombok` - koduck-common 已依赖 ✅

无其他 koduck-core 内部依赖，可以安全迁移。

## Consequences

### 正向影响

1. **职责清晰**：通用 DTO 归到 common 模块，符合分层设计
2. **复用便利**：后续拆分 market、portfolio 等模块时，可以直接依赖 koduck-common
3. **编译加速**：koduck-common 无数据库等重依赖，编译更快

### 代价与风险

1. **导入路径变化**：虽然包名不变，但物理位置变化
2. **IDE 索引**：需要重新索引，可能影响开发体验

### 兼容性影响

- **API 兼容性**：无变化，PageResponse 的包名和字段保持不变
- **行为兼容性**：无变化，纯代码位置迁移
- **依赖兼容性**：koduck-core 通过 Maven 依赖继续使用 PageResponse

## Alternatives Considered

1. **在每个模块中定义自己的分页响应类**
   - 拒绝：重复代码，增加维护成本

2. **保持现状，不迁移**
   - 拒绝：阻碍后续模块拆分，其他模块必须依赖 koduck-core 才能使用 PageResponse

## Implementation Plan

1. 在 koduck-common 中创建 dto/common 目录
2. 迁移 PageResponse.java
3. 从 koduck-core 删除 PageResponse.java
4. 运行质量门禁验证

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `koduck-backend/scripts/quality-check.sh` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- 所有现有测试通过
