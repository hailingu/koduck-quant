# Alibaba Java Coding Guidelines - Key Points

This document extracts the core rules from the Alibaba Java Coding Standard for
reference by the `java-coder-specialist` agent.

Full specification: [Alibaba p3c repository](https://github.com/alibaba/p3c)

## 1. Naming Conventions

### 1.1 Mandatory Rules

- **Class names**: Use UpperCamelCase (suffixes such as DO/DTO/VO/DAO are allowed),
  e.g., `UserService`, `OrderDTO`.
- **Method names, parameter names, field names, local variables**: Use lowerCamelCase,
  e.g., `getUserName()`, `orderList`.
- **Constants**: UPPER_SNAKE_CASE, e.g., `MAX_STOCK_COUNT`, `DEFAULT_CHARSET`.
- **Package names**: lowercase, each segment a single meaningful English word,
  e.g., `com.alibaba.ai.util`.

### 1.2 Recommended Rules

- Use `Abstract` or `Base` prefix for abstract classes.
- Exception classes should end with `Exception`.
- Test class names should be `<ClassName>Test` (e.g., `UserServiceTest`).
- Avoid `is` prefix on boolean fields in POJOs (some frameworks may mis-handle serialization).

## 2. Constants

### 2.1 Mandatory Rules

- Do not use magic values directly; extract to named constants.
- For `long` literals append upper-case `L`: `2L` (not `2l`).
- Do not maintain all constants in a single class; organize by feature.

### 2.2 Example

```java
public class CacheKeyConstants {
    public static final String LOGIN_MEMBER_KEY = "login:member:key:";
}

public class ConfigConstants {
    public static final int MAX_RETRY_COUNT = 3;
    public static final long DEFAULT_TIMEOUT = 30000L;
}
```

## 3. Code Formatting

### 3.1 Mandatory Rules

- Braces: opening brace on same line, newline after opening brace, newline before
  closing brace.
- Do not add spaces immediately inside parentheses; use a space between keywords
  and parentheses, e.g., `if (condition)`.
- Operators should have spaces around them.
- Indent with 4 spaces; do not use tabs.
- Limit lines to 120 characters; wrap long lines.

### 3.2 Line Wrapping

```java
// Correct example
StringBuilder sb = new StringBuilder();
sb.append("Rule 1:")
  .append("When wrapping, keep operator with the following line")
  .append("Rule 2:")
  .append("Indent continuation lines by 4 spaces");
```

## 4. OOP Conventions

### 4.1 Mandatory Rules

- Access static variables or methods via the class name rather than an instance.
- All overridden methods must include the `@Override` annotation.
- Variable-arity parameters (varargs) may only be used when parameter types are consistent and intended.
- Do not change public method signatures of libraries or external interfaces.
- Do not use deprecated classes or methods.
- Call `equals` on a constant or a known-non-null object to avoid NPE: use
  `"test".equals(object)` or `Objects.equals(obj1, obj2)`.

```java
// Recommended
"test".equals(object);
Objects.equals(obj1, obj2);
```

### 4.2 POJO Rules

- Use boxed types for POJO fields (e.g., `Integer`, `Long`, `Boolean`).
- Do not add `is` prefix to boolean fields.
- Do not modify `serialVersionUID` when adding new fields to a serializable class.

## 5. Collections

### 5.1 Mandatory Rules

- When overriding `equals`, always override `hashCode`.
- Use `new ArrayList<>(initialCapacity)` to specify initial collection size when
  appropriate.
- Iterate maps with `entrySet()` rather than `keySet()`.

```java
// Recommended
Map<String, String> map = new HashMap<>(16);
for (Map.Entry<String, String> entry : map.entrySet()) {
    String key = entry.getKey();
    String value = entry.getValue();
}
```

### 5.2 Recommendations

- Specify initial capacity when creating collections where appropriate.
- Use `isEmpty()` rather than checking `size() == 0`.

## 6. Concurrency

### 6.1 Mandatory Rules

- Ensure singleton instances and their methods are thread-safe.
- Give meaningful names to threads or thread pools to aid debugging.
- Use thread pools for thread management; do not create raw threads.
- Prefer constructing `ThreadPoolExecutor` directly over `Executors` helpers.

```java
// Recommended
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    5, 10, 60L, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(100),
    new ThreadFactoryBuilder().setNameFormat("XX-task-%d").build(),
    new ThreadPoolExecutor.AbortPolicy()
);
```

### 6.2 Locking Guidelines

- Consider lock overhead at high concurrency; prefer lock-free structures when possible.
- When acquiring multiple locks, maintain a consistent lock ordering to avoid deadlocks.

## 7. Control Flow

### 7.1 Mandatory Rules

- In a `switch` block, each `case` must terminate (e.g., `break`, `return`) or clearly
  document fall-through behavior.
- Always use braces for `if/else/for/while/do` constructs.
- Avoid using equality comparisons as loop termination in high-concurrency contexts.
- Prefer guard clauses over nested `if-else` for error handling.

```java
// Guard clause example
public void method(Param param) {
    if (param == null) {
        return;
    }
    // normal logic
}
```

### 7.2 Recommendations

- Use ternary operator for simple `if-else` expressions where it improves clarity.
- Move heavy operations (object creation, DB calls) outside loops when possible.

## 8. Documentation (Javadoc)

### 8.1 Mandatory Rules

- Public classes, fields, and methods must include Javadoc.
- All abstract methods (including interface methods) must have Javadoc.
- Include author and creation date in class-level Javadoc.
- Inline comments should be on the line above the commented statement using `//`.

```java
/**
 * User service implementation
 *
 * @author zhangsan
 * @date 2026-01-24
 */
public class UserServiceImpl implements UserService {
    
    /**
     * Get user by id
     *
     * @param userId user id
     * @return user info, or null if not found
     */
    @Override
    public User getUserById(Long userId) {
        // parameter validation
        if (userId == null || userId <= 0) {
            return null;
        }
        return userMapper.selectById(userId);
    }
}
```

### 8.2 Recommendations

- Use `TODO` and `FIXME` with author and date when leaving temporary notes.
- Update comments when code changes.

## 9. Exception Handling

### 9.1 Mandatory Rules

- Do not catch RuntimeExceptions that can be avoided via pre-condition checks.
- Do not use exceptions for normal control flow.
- Distinguish stable and unstable code when catching: stable code should not throw.
- Catch exceptions only to handle them properly; do not swallow exceptions.

```java
// Do not swallow exceptions
try {
    method();
} catch (Exception e) {
    // do nothing
}

// Recommend logging at minimum
try {
    method();
} catch (Exception e) {
    log.error("Method execution failed", e);
}
```

### 9.2 Transaction Rules

- When a try block includes transactional operations, ensure explicit rollback on
  errors if needed.
- Avoid transactions for operations known to cause unique key conflicts or large batches.

## 10. Logging

### 10.1 Mandatory Rules

- Use SLF4J facade, not logging implementation APIs directly (Log4j/Logback internals).
- Log retention: keep logs for at least 15 days where possible.
- Naming convention for extended logs: `appName_logType_logName.log`.

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserService {
    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    
    public void method() {
        log.info("Processing user request");
        log.error("Error occurred", exception);
    }
}
```

### 10.2 Recommendations

- Avoid debug logging in production environments.
- Use WARN level for client input validation issues.

## 11. MySQL Database

### 11.1 Table Naming and Schema Rules

- Boolean fields should use `is_xxx` naming convention and be represented as
  `unsigned tinyint` (1 for true, 0 for false).
- Table and column names must be lowercase or digits, not starting with a digit,
  and avoid two underscores with only digits between them.
- Primary index names: `pk_<column>`; unique indexes: `uk_<column>`; normal indexes:
  `idx_<column>`.
- Use `decimal` for fixed-point numbers; avoid `float` and `double`.
- Common mandatory columns: `id`, `create_time`, `update_time`.

### 11.2 SQL Rules

- Use `count(*)` rather than `count(column)` or `count(constant)` to get total rows.
- When a column contains only NULL values, `count(col)` returns 0.
- Avoid foreign keys and cascades; enforce relational integrity at the application layer.

## 12. Project Structure

### 12.1 Application Layers

```text
├── controller    // presentation layer, handles requests
├── service       // business logic
│   ├── impl      // implementations
├── manager       // common business utilities (optional)
├── dao/mapper    // data access
├── model/entity  // data models
│   ├── dto       // data transfer objects
│   ├── vo        // view objects
│   ├── bo        // business objects
```

### 12.2 Third-party Libraries

- GAV convention: GroupId should follow `com.{company/BU}.business.<subdomain>` (where "subdomain" refers to a specific product area or service, e.g., `payments`).
- When adding/upgrading libraries, keep other dependency arbitration results unchanged.

---

## References

- Alibaba Java Coding Standard (official PDF)
- GitHub: [Alibaba p3c repository](https://github.com/alibaba/p3c)
- IDEA plugin: Alibaba Java Coding Guidelines
