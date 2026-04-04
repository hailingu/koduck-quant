# ADR-0080: 统一 DataServiceProperties 配置注入方式

- Status: Accepted
- Date: 2026-04-04
- Issue: #454

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的评估，`DataServiceProperties` 类中混用了两种配置注入方式：

| 字段 | 注入方式 | 示例 |
|------|----------|------|
| baseUrl | `@ConfigurationProperties` | `private String baseUrl = DEFAULT_BASE_URL;` |
| connectTimeoutMs | `@ConfigurationProperties` | `private int connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;` |
| realtimeUpdatePath | `@Value` | `@Value("${koduck.data-service.realtime-update-path:...}")` |

这种混用带来以下问题：

1. **注入行为不一致**：`@ConfigurationProperties` 支持松散绑定（如 `realtime-update-path` 可匹配 `REALTIME_UPDATE_PATH`），而 `@Value` 严格匹配键名
2. **验证时机不一致**：`@NotBlank` 对 `@Value` 字段的验证时机可能与 `@ConfigurationProperties` 不同
3. **可维护性差**：混用两种方式增加认知负担，新开发者不知道应该使用哪种方式
4. **IDE 支持差异**：`@ConfigurationProperties` 有更好的 IDE 自动补全和配置元数据支持

## Decision

### 1. 移除 @Value 注解

将 `realtimeUpdatePath` 字段从：

```java
@Value("${koduck.data-service.realtime-update-path:/market/realtime/update}")
@NotBlank
private String realtimeUpdatePath;
```

改为：

```java
@NotBlank
private String realtimeUpdatePath = DEFAULT_REALTIME_UPDATE_PATH;
```

### 2. 添加常量定义

添加默认值的常量定义：

```java
private static final String DEFAULT_REALTIME_UPDATE_PATH = "/market/realtime/update";
```

### 3. 更新 application.yml

在配置文件中添加该属性的默认配置：

```yaml
koduck:
  data-service:
    base-url: http://localhost:8000/api/v1
    connect-timeout-ms: 10000
    read-timeout-ms: 60000
    max-retries: 3
    realtime-update-path: /market/realtime/update  # 新增
    enabled: true
```

### 4. 移除 @Value 导入

删除类中的 `@Value` 注解导入：

```java
// 移除这一行
import org.springframework.beans.factory.annotation.Value;
```

## Consequences

### 正向影响

- **注入行为一致**：所有字段使用统一的 `@ConfigurationProperties` 绑定方式
- **松散绑定支持**：环境变量如 `KODUCK_DATA_SERVICE_REALTIME_UPDATE_PATH` 可以正确映射
- **IDE 支持优化**：IDE 可以提供更好的配置自动补全和导航
- **代码简化**：移除 `@Value` 注解，减少注解复杂度

### 兼容性影响

- **无 API 变更**：HTTP 接口、DTO、数据库表结构均无变化
- **配置变更**：`application.yml` 新增 `realtime-update-path` 配置项，但默认值与原 `@Value` 默认值一致
- **行为一致**：运行时行为完全一致，仅注入方式改变

## Alternatives Considered

1. **保留 @Value，将其他字段改为 @Value**
   - 拒绝：`@Value` 不支持松散绑定，且不支持 JSR-303 验证注解与 `@ConfigurationProperties` 配合得好
   - 当前方案：统一使用 `@ConfigurationProperties`

2. **使用 @PostConstruct 手动设置默认值**
   - 拒绝：增加了不必要的运行时逻辑，不如字段初始化简洁
   - 当前方案：直接在字段上设置默认值

3. **使用构造函数注入**
   - 拒绝：`@ConfigurationProperties` 类通常使用 setter 注入，且需要保留无参构造函数用于绑定
   - 当前方案：保持字段初始化方式

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- `DataServicePropertiesTest` 单元测试通过
