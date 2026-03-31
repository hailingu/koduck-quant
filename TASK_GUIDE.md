# P2-03: 模块边界梳理开发指南

## 任务目标
梳理核心模块边界，收敛依赖关系，提升模块化与可维护性。

## 当前架构分析

### 目录结构
```
com.koduck/
├── client/          # 外部客户端调用
├── common/          # 共享常量/工具
├── config/          # 配置类
├── controller/      # API 控制器层
├── dto/             # 数据传输对象
├── entity/          # JPA 实体
├── exception/       # 异常定义
├── mapper/          # MapStruct 映射
├── market/          # 行情模块
├── messaging/       # 消息队列
├── repository/      # 数据访问层
├── security/        # 安全认证
├── service/         # 业务逻辑层
└── util/            # 工具类
```

## 开发步骤

### 1. 生成当前依赖图

```bash
# 使用 Maven 依赖分析
cd koduck-backend
mvn dependency:analyze -DoutputType=graph

# 或使用 JDepend
mvn jdepend:generate
```

### 2. 检查违规依赖

创建脚本检查以下问题：

```bash
#!/bin/bash
# check-violations.sh

echo "=== 检查跨层依赖违规 ==="

# 1. Repository 层不应调用 Service 层
grep -r "import com.koduck.service" src/main/java/com/koduck/repository/ && echo "❌ 发现 repository -> service 违规" || echo "✅ repository 层干净"

# 2. Service 层不应调用 Controller 层
grep -r "import com.koduck.controller" src/main/java/com/koduck/service/ && echo "❌ 发现 service -> controller 违规" || echo "✅ service 层干净"

# 3. 检查循环依赖
# 使用 Maven 或 jdeps 工具
```

### 3. 梳理依赖方向

创建 `docs/architecture/module-boundary.md`：

```markdown
## 模块依赖规则

### 分层依赖方向
```
Controller → Service → Repository → Entity
    ↓           ↓           ↓
   DTO        DTO/Entity   Entity
```

### 禁止的依赖
- ❌ Repository → Service
- ❌ Service → Controller
- ❌ Entity → DTO

### 允许的跨模块调用
- ✅ Service 之间可以调用（注意避免循环）
- ✅ 通过接口解耦
```

### 4. 识别循环依赖

检查以下模式：
```
ServiceA -> ServiceB -> ServiceA
ervice -> MarketService -> Service
```

### 5. 重构计划

对于发现的违规依赖：

#### 方案 A: 提取公共接口
```java
// 创建接口
public interface DataProvider {
    MarketData getData(String symbol);
}

// Service 依赖接口而非实现
@Service
public class MarketService {
    private final DataProvider dataProvider;
    
    public MarketService(DataProvider dataProvider) {
        this.dataProvider = dataProvider;
    }
}
```

#### 方案 B: 事件驱动解耦
```java
// 使用 Spring Event
@Component
public class OrderEventListener {
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        // 处理订单创建
    }
}
```

### 6. 建立边界检查 CI

创建 `.github/workflows/arch-guard.yml`：

```yaml
name: Architecture Guard
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check architecture violations
        run: |
          cd koduck-backend
          chmod +x scripts/check-arch-violations.sh
          ./scripts/check-arch-violations.sh
```

## 验收标准
- [ ] 产出模块边界文档
- [ ] 产出依赖关系图（改造前后对比）
- [ ] 消除所有跨层反向依赖
- [ ] 消除关键循环依赖
- [ ] 回归测试全通过
