# ADR-0052: Constant 层冗余消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #396

## Context

根据 `koduck-backend/docs/constant-redundancy-analysis.md` 分析报告，koduck-backend 存在大量常量重复定义问题：

- 16 组重复定义的常量
- 涉及 20+ 个文件
- 违反 DRY 原则，增加维护成本

### 冗余类型

1. **完全重复定义**：同值同变量名在不同文件中独立定义（如 `KEY_SYMBOL = "symbol"` 出现在 3 个文件）
2. **重复包装已集中常量**：本地变量包装 `MarketConstants` 已有常量
3. **同值不同变量名**：相同概念使用不同变量名（如 `ZoneId.of("Asia/Shanghai")` 出现在 4 个文件）

## Decision

### 决策 1: 新增集中常量类

| 新常量类 | 职责 | 包含常量 |
|----------|------|---------|
| `MapKeyConstants` | Map 字段键名 | `KEY_SYMBOL`, `KEY_NAME`, `KEY_CONTENT` |
| `LlmConstants` | LLM 提供商相关 | `PROVIDER_MINIMAX`, `ENV_LLM_API_BASE` |
| `AiConstants` | AI 分析相关 | `RISK_AGGRESSIVE`, `RISK_CONSERVATIVE` |
| `DataServicePathConstants` | 数据服务路径 | `A_SHARE_BASE_PATH` |

### 决策 2: 扩展现有常量类

| 现有类 | 新增常量 |
|--------|---------|
| `MarketConstants` | `STOCK_TYPE`, `A_SHARE_INDEX_SYMBOL`, `ALL_TIMEFRAMES` |
| `DateTimePatternConstants` | `MARKET_ZONE_ID` (重命名为 `DateTimeConstants`) |

### 决策 3: 消除冗余包装

删除本地变量包装，直接引用 `MarketConstants`：
- `DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME` → 直接引用
- `DEFAULT_MARKET = MarketConstants.DEFAULT_MARKET` → 直接引用

## Consequences

### 正向影响

- 消除代码重复，统一常量管理
- 提高可维护性，减少变更遗漏风险
- 符合 DRY 原则

### 消极影响

- 需要修改多个文件（20+ 个）
- 需要创建 4 个新常量类
- 有一定的代码变更量

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 无 | 常量变更不影响 API |
| 业务逻辑 | 无 | 常量值保持不变 |
| 序列化 | 无 | 不涉及实体变更 |
| 测试 | 低 | 需验证常量引用正确 |

## 实施顺序

1. 先新增常量类和常量字段
2. 逐步替换引用（按模块分批）
3. 删除冗余的本地常量定义
4. 运行质量检查确保全绿

## Related

- Issue #396
- `koduck-backend/docs/constant-redundancy-analysis.md`
