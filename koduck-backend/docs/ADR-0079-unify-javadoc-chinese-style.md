# ADR-0079: 统一 Javadoc 为中文风格

- Status: Accepted
- Date: 2026-04-04
- Issue: #452

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的评估，项目中存在混合中英文 Javadoc 的问题：

| 层级 | 当前语言 | 示例 |
|------|----------|------|
| 类级 Javadoc | 英文 | `/** Service for market data operations. */` |
| 方法级 Javadoc | 中文 | `/** 根据用户ID获取用户信息。 */` |
| 参数 @param | 中文 | `@param userId 用户唯一标识` |
| 返回值 @return | 中文 | `@return 用户对象` |

这种混合带来以下问题：

1. **阅读一致性差**：开发者需要在两种语言之间频繁切换
2. **维护困惑**：新增代码时不知道应该使用哪种语言
3. **风格不统一**：部分文件全英文，部分混合，增加认知负担

## Decision

### 1. 统一使用中文 Javadoc

所有 Javadoc 统一为中文风格，包括：

- 类级描述
- 方法级描述
- `@param` 参数说明
- `@return` 返回值说明
- `@throws` 异常说明
- `@see` 参考说明

### 2. 保留英文的场景

以下情况保留英文：

- 代码中的命名（类名、方法名、变量名）保持英文
- 引用第三方库/框架的官方术语
- DTO/Entity 的字段名（与数据库列名保持一致）

### 3. 术语处理规范

| 英文术语 | 中文翻译 | 备注 |
|----------|----------|------|
| Service | 服务 | 直接使用 |
| Repository | 仓库/数据访问层 | 根据上下文选择 |
| Controller | 控制器 | 直接使用 |
| DTO | 数据传输对象 | 首次出现可写全称 |
| Entity | 实体 | 直接使用 |
| ID | 标识/ID | 技术术语可保留英文 |

### 4. 批量修改范围

本次修改覆盖以下文件类型：

- `service/` 包下的所有接口和实现类
- `controller/` 包下的所有控制器
- `repository/` 包下的所有仓库接口
- `entity/` 包下的所有实体类
- `dto/` 包下的所有 DTO
- `config/` 包下的所有配置类

## Consequences

### 正向影响

- **阅读一致性**：全中文文档降低阅读认知负担
- **维护明确**：后续新增代码有明确的语言规范
- **团队友好**：中文母语开发者更容易理解和维护
- **与项目文档对齐**：与 `AGENTS.md`、`README.md` 等中文文档保持一致

### 兼容性影响

- **无 API 变更**：仅修改注释，不修改代码逻辑
- **无行为变更**：运行时行为完全一致
- **文档变更**：所有 Javadoc 风格统一为中文

## Alternatives Considered

1. **统一为英文 Javadoc**
   - 拒绝：项目主要面向中文用户和开发者，英文质量难以保证，且与项目其他中文文档不一致
   - 当前方案：统一为中文，符合项目定位和团队背景

2. **按层级区分（类级英文、方法级中文）**
   - 拒绝：这是当前的混乱来源，继续保留无法解决问题
   - 当前方案：彻底统一，不区分层级

3. **按模块区分（核心模块英文、业务模块中文）**
   - 拒绝：增加维护复杂度，不同模块风格不一
   - 当前方案：全项目统一规范

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有 Javadoc 检查为中文风格
