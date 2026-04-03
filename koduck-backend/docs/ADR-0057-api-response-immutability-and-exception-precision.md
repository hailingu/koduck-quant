# ADR-0057: ApiResponse 不可变改造与异常捕获精细化

- Status: Accepted
- Date: 2026-04-04
- Issue: #406

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的代码质量评估，`koduck-backend` 存在以下问题：

1. `MarketServiceImpl` 中多处使用 `catch (Exception e)`，捕获范围过宽，吞掉了具体异常类型，导致调用方难以根据异常类型做差异化处理，也掩盖了本应立即暴露的系统缺陷。
2. `ApiResponse` 作为全局统一响应包装类，使用了 `@Data`（含 setter），构造完成后仍可从外部修改字段，破坏了响应对象的不可变性。
3. 部分 DTO 仍为可变类设计，存在线程安全隐患。

## Decision

### 1. ApiResponse 改为不可变对象

- 移除 `@Data`、`@NoArgsConstructor`、`@AllArgsConstructor`。
- 所有字段声明为 `final`，仅暴露 `@Getter`。
- 保留已有的 `public ApiResponse(int code, String message, T data)` 构造器与静态工厂方法（`success`、`error` 系列）作为唯一构造入口。
- 已手动实现的 `toString()`、`equals()`、`hashCode()` 继续保留，行为不变。

### 2. MarketServiceImpl 异常捕获精细化

- 将 `catch (Exception e)` 统一收窄为 `catch (RuntimeException e)`，避免吞掉受检异常（如 `IOException`、`SQLException`）等非预期错误。
- `getStockValuation()` 中原有的 `try-catch` 仅做 `throw e`，无实际处理价值，直接移除，减少不必要的嵌套。
- 保留现有的 fallback 降级逻辑（日志记录 + 返回默认值/null），因为测试用例已验证运行时异常需要触发 fallback。

### 3. PriceUpdateDto 改为 record

- 将 `PriceUpdateDto` 从 `@Data` class 重构为 Java `record`，并保留 builder 模式以兼容现有调用方。
- 同步更新 `StockSubscriptionService` 及其实现类中对 `PriceUpdateDto` getter 的调用方式（从 `getXxx()` 调整为 `xxx()`）。

## Consequences

正向影响：

- `ApiResponse` 不再暴露 setter，响应对象在构造后不可变，降低被意外篡改的风险。
- 异常捕获范围从 `Exception` 收窄到 `RuntimeException`，避免受检异常被无意义吞掉，问题定位更精确。
- `PriceUpdateDto` 利用 `record` 原生不可变语义，提升线程安全性。

代价：

- `ApiResponse` 不可变后，若未来有反序列化需求，需要补充 `@JsonCreator`；当前仅作为响应序列化对象，无影响。
- `PriceUpdateDto` 改为 record 后，外部代码需使用组件访问符（`symbol()`）而非 `getSymbol()`，本次已同步修改受影响文件。

## Alternatives Considered

1. **一次性将所有 DTO 改为 record/@Value**
   - 拒绝：影响面过大（涉及 AI、社区、用户等 15+ 子包），可能导致 MapStruct 配置、测试夹具大面积调整，超出轻量 issue 范围。决定采用渐进式迁移，本次仅处理市场模块核心 DTO 与全局 ApiResponse。

2. **保留 `catch (Exception e)`，仅增加异常类型日志**
   - 拒绝：无法解决根本问题，调用方仍然拿不到原始异常类型，且容易把系统级错误（如 OOM、InterruptedException）一并吞掉。

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过。
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常。
- `./koduck-backend/scripts/quality-check.sh` 全绿。
- 相关单元测试（`MarketServiceImplTest`、`GlobalExceptionHandlerTest` 等）全部通过。
