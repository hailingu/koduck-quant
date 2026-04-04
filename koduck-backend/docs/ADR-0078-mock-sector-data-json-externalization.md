# ADR-0078: Mock 板块网络数据 JSON 外部化

- Status: Accepted
- Date: 2026-04-04
- Issue: #450

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的评估，`MockSectorNetworkGenerator` 中存在约 130 个硬编码的 `BigDecimal` 常量（如 `MARKET_CAP_8500`、`FLOW_67_3` 等），占据约 160 行代码。

当前问题：

| 问题 | 影响 |
|------|------|
| 数据与代码耦合 | 修改 Mock 数据需要重新编译部署 |
| 可读性差 | 纯代码形式难以一眼看出数据结构 |
| 违反 SRP | 类既负责"如何生成"，又包含"什么数据" |
| 代码膨胀 | 160+ 行常量定义占据类的主要体积 |

## Decision

### 1. 将 Mock 数据移至 JSON 资源文件

创建 `src/main/resources/mock/sector-network.json`，包含完整的板块节点和关联数据：

```json
{
  "nodes": [...],
  "links": [...]
}
```

### 2. 使用 Jackson 反序列化

利用 `ObjectMapper` 将 JSON 直接映射到 DTO 结构：

```java
SectorNetworkData data = objectMapper.readValue(resource.getInputStream(), SectorNetworkData.class);
```

### 3. 添加条件装配控制

使用 `@ConditionalOnProperty` 控制 Mock 数据源的启用：

```yaml
mock:
  sector-network:
    enabled: true  # false 时抛出异常或返回空数据
```

### 4. 数据与类型分离

- JSON 文件只包含纯数据（数值、字符串）
- Java 代码负责类型转换（如 linkType 的注入）

## Consequences

### 正向影响

- **数据外部化**：非技术人员可直接修改 JSON 文件
- **无需重新编译**：更新数据只需替换资源文件
- **代码简化**：`MockSectorNetworkGenerator` 从 279 行减少到约 50 行
- **可读性提升**：JSON 结构直观展示数据关系

### 兼容性影响

- **无 API 变更**：HTTP 接口、DTO 结构保持不变
- **配置变更**：新增 `mock.sector-network.enabled` 属性，默认为 `true`
- **行为变更**：首次启动时会从 classpath 加载 JSON 文件

## Alternatives Considered

1. **使用 YAML 格式替代 JSON**
   - 拒绝：虽然 YAML 支持注释，但项目已广泛使用 JSON 进行数据交换，且 Jackson 对 JSON 支持更成熟
   - 当前方案：使用 JSON，与现有 `application.yml` 配置文件格式区分

2. **使用数据库存储 Mock 数据**
   - 拒绝：增加数据库表结构复杂度，且 Mock 数据本质上是临时的演示数据
   - 当前方案：使用资源文件，轻量且易于版本控制

3. **保留硬编码，仅提取常量到单独类**
   - 拒绝：未解决根本问题（数据与代码耦合），且需要重新编译
   - 当前方案：彻底外部化到 JSON

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- JSON 文件格式校验通过
- 单元测试验证 Mock 数据加载正确
