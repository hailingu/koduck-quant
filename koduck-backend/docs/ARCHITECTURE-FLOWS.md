# Architecture Decision Tree & Key Business Flows

本文档提供关键业务路径的可视化说明，作为代码阅读与架构评审的快速入口。

## 1. 架构决策树（后端业务变更）

```mermaid
flowchart TD
    A["新增/变更后端业务需求"] --> B{"是否涉及外部依赖调用?"}
    B -->|是| C["定义 Provider 接口与统一错误映射"]
    B -->|否| D{"是否属于批量持久化路径?"}
    C --> E["启用 Circuit Breaker + fallback 策略"]
    E --> F["补充监控指标与超时/重试配置"]
    D -->|是| G["启用 JDBC Batch 并评估批大小"]
    D -->|否| H{"是否引入新 API 能力?"}
    G --> I["验证事务边界与写入吞吐"]
    H -->|是| J["遵循 /api/v{n} 版本策略并更新文档"]
    H -->|否| K{"是否新增领域异常语义?"}
    J --> L["补充版本迁移说明与兼容策略"]
    K -->|是| M["扩展 ErrorCode 与 Service 异常规范"]
    K -->|否| N["按既有模块规范实现"]
    F --> O["提交 ADR + 流程图文档更新"]
    I --> O
    L --> O
    M --> O
    N --> O
```

## 2. 关键流程图：KLine 查询与同步触发

```mermaid
flowchart TD
    A["Client 请求 KLine 数据"] --> B["MarketController 接收请求"]
    B --> C["MarketService / ProviderFactory 选择 Provider"]
    C --> D{"本地缓存/存储命中?"}
    D -->|是| E["直接返回数据"]
    D -->|否| F["触发数据同步任务（非阻塞）"]
    F --> G["立即返回当前可用结果或空数据标记"]
    G --> H["异步链路补齐数据"]
    H --> I["后续查询命中缓存/存储"]
```

## 3. 关键流程图：回测执行链路

```mermaid
flowchart TD
    A["发起 runBacktest 请求"] --> B["BacktestService 校验策略归属"]
    B --> C["加载 active/latest strategy version"]
    C --> D["初始化 BacktestResult(RUNNING)"]
    D --> E["加载并过滤历史 KLine"]
    E --> F{"数据量 >= 最小门槛?"}
    F -->|否| G["抛出 BusinessException(BACKTEST_INSUFFICIENT_DATA)"]
    F -->|是| H["执行信号循环与撮合模拟"]
    H --> I["计算收益/回撤/Sharpe 等指标"]
    I --> J["保存交易与回测结果"]
    J --> K["结果置为 COMPLETED"]
    G --> L["结果置为 FAILED 并记录 errorMessage"]
```

## 4. 关键流程图：Service 异常规范映射

```mermaid
flowchart TD
    A["Service 发现异常场景"] --> B{"资源不存在?"}
    B -->|是| C["ResourceNotFoundException"]
    B -->|否| D{"参数/规则校验失败?"}
    D -->|是| E["ValidationException 或 BusinessException(ErrorCode)"]
    D -->|否| F{"状态冲突?"}
    F -->|是| G["StateException"]
    F -->|否| H{"重复操作?"}
    H -->|是| I["DuplicateException"]
    H -->|否| J["按领域定义补充 BusinessException + ErrorCode"]
```

## 5. 维护约定

- 当关键业务路径发生明显调整时，必须同步更新本文件对应流程图。
- 涉及架构策略变化时，需新增或更新 ADR，并在 `docs/README.md` 建立索引入口。
- 流程图应优先描述“职责边界 + 决策节点 + 异常路径”，避免落入实现细节。
