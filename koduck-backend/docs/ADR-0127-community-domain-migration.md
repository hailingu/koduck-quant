# ADR-0127: Community 领域模块迁移

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #568

## 背景

作为 Core 模块迁移（Phase 2）的一部分，需要将 Community（社区）领域从 koduck-core 迁移到独立的模块。Community 领域主要包括信号系统（Signal）、评论（Comment）和点赞（Like）功能。

信号系统允许用户发布交易策略信号，其他用户可以查看、评论和点赞。信号通常与投资组合相关联，需要通过 Portfolio ACL 查询相关信息。

## 决策

创建独立的 koduck-community 模块，包含 koduck-community-api 子模块，遵循 API/Impl 分离的架构原则。

### 架构设计

```
koduck-community/
├── koduck-community-api/          # 接口与 DTO
│   ├── api/
│   │   ├── SignalQueryService.java
│   │   ├── SignalCommandService.java
│   │   ├── CommentQueryService.java
│   │   ├── CommentCommandService.java
│   │   ├── LikeQueryService.java
│   │   └── LikeCommandService.java
│   ├── acl/
│   │   └── CommunityQueryService.java    # 供其他模块使用
│   ├── dto/
│   │   ├── SignalDto.java
│   │   ├── SignalSummaryDto.java
│   │   ├── SignalDetailDto.java
│   │   ├── CommentDto.java
│   │   ├── CommentSummaryDto.java
│   │   └── LikeDto.java
│   ├── vo/
│   │   └── SignalSnapshot.java
│   ├── event/
│   │   ├── SignalPublishedEvent.java
│   │   └── CommentCreatedEvent.java
│   └── exception/
│       ├── CommunityException.java
│       └── SignalException.java
└── koduck-community-impl/         # 实现（后续创建）
    ├── service/
    │   ├── SignalServiceImpl.java
    │   ├── CommentServiceImpl.java
    │   └── LikeServiceImpl.java
    ├── repository/
    │   ├── SignalRepository.java
    │   ├── CommentRepository.java
    │   └── LikeRepository.java
    └── entity/
        ├── Signal.java
        ├── Comment.java
        └── Like.java
```

### 依赖关系

```
koduck-community-api
    ├── koduck-common (工具类、基础异常)
    ├── koduck-portfolio-api (通过 ACL 获取投资组合信息)
    └── spring-context (领域事件)

koduck-community-impl (后续创建)
    ├── koduck-community-api
    ├── koduck-portfolio-api (ACL 接口)
    ├── koduck-infrastructure (Repository 实现)
    └── koduck-common
```

### ACL 接口设计

Community 模块为其他模块提供 ACL 接口：

```java
public interface CommunityQueryService {
    // 获取信号快照
    Optional<SignalSnapshot> getSignalSnapshot(Long signalId);
    
    // 获取用户的信号列表
    List<SignalSnapshot> getUserSignals(Long userId);
    
    // 获取投资组合相关的信号
    List<SignalSnapshot> getPortfolioSignals(Long portfolioId);
    
    // 获取信号的统计信息
    SignalStatistics getSignalStatistics(Long signalId);
}
```

Community 模块通过 ACL 访问 Portfolio 数据：

```java
@Service
public class SignalServiceImpl {
    // 通过 Portfolio ACL 获取投资组合信息
    private final PortfolioQueryService portfolioQueryService;
    
    public SignalDetailDto getSignalDetail(Long signalId) {
        Signal signal = signalRepository.findById(signalId);
        // 通过 ACL 获取投资组合快照
        PortfolioSnapshot portfolio = portfolioQueryService
            .getSnapshot(signal.getPortfolioId())
            .orElse(null);
        // ...
    }
}
```

## 权衡

### 替代方案

1. **保留在 koduck-core**: 不迁移 Community 领域
   - ❌ koduck-core 继续膨胀
   - ❌ 社区功能与核心业务耦合
   - ❌ 无法独立扩展社区功能

2. **合并到 koduck-strategy**: 将社区和策略合并
   - ❌ 社区和策略是不同的领域
   - ❌ 社区功能（评论、点赞）与策略无关
   - ❌ 职责不清晰

3. **创建独立服务**: 拆分为微服务
   - ✅ 完全独立部署
   - ❌ 当前阶段过度设计
   - ❌ 增加运维复杂度
   - ⏸️ 未来可考虑，当前使用模块化

### 选择当前方案的理由

1. **渐进式演进**: 从模块化开始，未来可演进为微服务
2. **清晰边界**: Community 领域独立，通过 ACL 与其他模块交互
3. **可测试性**: 独立模块易于单元测试和集成测试
4. **复用性**: 社区功能可以被多个模块使用

## 影响

### 兼容性影响

- **koduck-core**: 移除 Community 相关代码
- **koduck-portfolio**: 通过 ACL 被 Community 模块使用
- **koduck-bootstrap**: 后续添加 koduck-community-impl 依赖

### 数据模型

Community 领域包含以下核心实体：
- **Signal**: 交易信号（标题、内容、关联投资组合、方向、价格等）
- **Comment**: 评论（关联信号、内容、作者）
- **Like**: 点赞（关联信号/评论、用户）

### 跨模块依赖

| 调用方 | 被调用方 | ACL 接口 | 用途 |
|--------|----------|----------|------|
| Community | Portfolio | `PortfolioQueryService` | 获取信号关联的投资组合信息 |
| AI | Community | `CommunityQueryService` | 分析热门信号 |

## 实施计划

### Phase 1: 创建 koduck-community-api 模块
1. 创建模块目录结构
2. 创建 pom.xml（依赖 koduck-common, koduck-portfolio-api）
3. 创建 Service 接口（Signal、Comment、Like）
4. 创建 DTO（SignalDto, CommentDto, LikeDto 等）
5. 创建 ACL 接口（供其他模块使用）
6. 创建值对象（SignalSnapshot）
7. 创建领域事件和异常

### Phase 2: 质量检查
1. 编译检查
2. Checkstyle 检查
3. SpotBugs 检查

### Phase 3: 更新依赖
1. 更新 koduck-community 父 pom
2. 验证整体编译

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md)
- ADR-0122: Portfolio 领域实现模块迁移
- ADR-0126: Strategy 领域模块迁移
