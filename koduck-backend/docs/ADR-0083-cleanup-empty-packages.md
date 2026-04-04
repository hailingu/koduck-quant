# ADR-0083: 清理 koduck-backend 空包

- Status: Accepted
- Date: 2026-04-04
- Issue: #460

## Context

在 koduck-backend 代码库演进过程中，由于重构、代码迁移或删除操作，可能产生一些空包（empty packages）。这些空包：

1. **影响代码可读性**：开发者浏览源码时会被空目录干扰
2. **增加认知负担**：空包的存在让新开发者困惑，不确定是否有意保留
3. **不符合代码规范**：整洁的代码库不应包含无用空目录

### 空包定义

空包指满足以下任一条件的目录：
- 不包含任何 `.java` 源文件
- 仅包含 `package-info.java` 但无实际代码
- 所有子目录均为空（递归空目录）

## Decision

### 1. 清理范围

清理 koduck-backend 中以下位置的 Java 源文件空包：
- `koduck-core/src/main/java/com/koduck/` 及其子目录
- `koduck-core/src/test/java/com/koduck/` 及其子目录

### 2. 清理原则

- 仅删除**完全为空**的包（不含 `.java` 文件）
- 保留包含 `.java` 文件的包，即使只有一个文件
- 不清理资源目录（`src/main/resources/`）

### 3. 检查方法

使用以下命令识别空包：

```bash
# 查找不包含 .java 文件的目录
find koduck-core/src/main/java/com/koduck -type d -not -path "*/target/*" | while read dir; do
    if [ -z "$(find "$dir" -name "*.java" 2>/dev/null)" ]; then
        echo "Empty: $dir"
    fi
done
```

## Consequences

### 正向影响

- **代码库整洁**：移除无用的空目录，提升代码可读性
- **减少混淆**：新开发者不会被空包误导
- **符合规范**：遵循整洁代码原则

### 兼容性影响

- **无 API 变更**：HTTP 接口、DTO、数据库表结构均无变化
- **无功能变更**：仅删除空目录，不影响任何业务逻辑
- **无配置变更**：配置文件无变化

## Alternatives Considered

1. **保留空包作为占位符**
   - 拒绝：空包会增加维护负担，未来需要时再创建即可
   - 当前方案：删除空包，按需创建

2. **使用 package-info.java 标记**
   - 拒绝：如果包中无实际代码，package-info.java 也是多余的
   - 当前方案：完全删除空包

## Verification

- [x] `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- [x] `./koduck-backend/scripts/quality-check.sh` 全绿
- [x] `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
