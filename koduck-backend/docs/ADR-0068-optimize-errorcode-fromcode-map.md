# ADR-0068: 将 ErrorCode.fromCode 优化为 Map 缓存查找

- Status: Accepted
- Date: 2026-04-04
- Issue: #430

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的性能与可维护性评估，`ErrorCode.fromCode(int code)` 当前采用线性遍历实现：

```java
public static ErrorCode fromCode(int code) {
    for (ErrorCode errorCode : values()) {
        if (errorCode.code == code) {
            return errorCode;
        }
    }
    return UNKNOWN_ERROR;
}
```

`ErrorCode` 枚举当前包含约 60 个值，这意味着：
- **时间复杂度为 O(n)**：最坏情况下需要遍历全部枚举值
- **`values()` 额外开销**：Java 枚举的 `values()` 每次调用都会生成一个新的数组副本
- **高频调用场景**：`fromCode` 被全局异常处理（`@ControllerAdvice`）、统一响应包装、日志记录等路径频繁调用，累积开销不可忽视

## Decision

### 1. 引入 static final Map 缓存

在枚举类加载时，通过 `Arrays.stream(values()).collect(...)` 将所有枚举值按 `code -> ErrorCode` 映射到不可变的 `Map` 中，并将 `fromCode` 改为 `Map.getOrDefault` 查找。

**修改后：**
```java
private static final java.util.Map<Integer, ErrorCode> CODE_MAP =
    java.util.Arrays.stream(values())
        .collect(java.util.Collections.unmodifiableMap(
            new java.util.HashMap<>() {
                {
                    for (ErrorCode errorCode : values()) {
                        put(errorCode.code, errorCode);
                    }
                }
            }
        ));
```

考虑到项目代码风格和简洁性，采用更直接的 `Collectors.toMap` 方式：

```java
private static final java.util.Map<Integer, ErrorCode> CODE_MAP =
    java.util.Arrays.stream(values())
        .collect(java.util.stream.Collectors.toMap(ErrorCode::getCode, e -> e));
```

或者使用静态代码块保持可读性：

```java
private static final java.util.Map<Integer, ErrorCode> CODE_MAP = new java.util.HashMap<>();

static {
    for (ErrorCode errorCode : values()) {
        CODE_MAP.put(errorCode.getCode(), errorCode);
    }
}
```

### 2. 修改 `fromCode` 实现

```java
public static ErrorCode fromCode(int code) {
    return CODE_MAP.getOrDefault(code, UNKNOWN_ERROR);
}
```

### 3. 不引入第三方依赖

仅使用 `java.util` 标准类，不引入 Guava 等外部库，保持依赖最小化。

## Consequences

### 正向影响

- **性能提升**：查找复杂度从 O(n) 降至 O(1)
- **消除 `values()` 数组拷贝开销**：Map 在类加载时初始化一次，后续直接复用
- **线程安全**：静态 final Map 在类加载完成后即不可变，天然线程安全
- **零行为差异**：对外 API 和返回值与修改前完全一致

### 兼容性影响

- **API 签名不变**：`fromCode(int)` 的方法签名、返回值、异常处理逻辑均无变化
- **错误码映射不变**：所有现有错误码的查找结果与线性遍历完全一致
- **内存开销极小**：60 个条目的 Map 占用内存可忽略
- **无调用方变更**：所有使用 `ErrorCode.fromCode` 的代码无需任何修改

## Alternatives Considered

1. **保留线性遍历**
   - 拒绝：性能存在可量化的优化空间，且改为 Map 缓存是零风险的标准做法
   - 当前方案：使用 Map 缓存

2. **使用 Guava `ImmutableMap`**
   - 拒绝：项目当前未引入 Guava，为此添加一个依赖属于过度设计
   - 当前方案：使用 JDK 标准 `HashMap` + `Collections.unmodifiableMap` 或直接静态代码块初始化

3. **使用 `EnumSet` 或位图**
   - 拒绝：`ErrorCode` 的 `code` 是离散整数（如 1000、1001、3602），不连续，不适合位图
   - 当前方案：使用 HashMap 最合适

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- `ErrorCodeTest` 全部通过，并新增测试验证 Map 缓存查找与线性遍历结果的一致性
