# P3-01 覆盖率门禁扩围记录（复核版）

> 关联 Issue: #250  
> 更新时间: 2026-04-01

## 1. 目标与验收口径

将 JaCoCo 门禁从仅 3 个类扩围到不少于 8 个核心类，并保持阈值不降低：

- Line 覆盖率阈值: `>= 60%`
- Branch 覆盖率阈值: `>= 40%`

## 2. 当前生效配置（代码事实）

`koduck-backend/pom.xml` 当前 JaCoCo 门禁 `includes` 为 8 个类：

1. `MemoryServiceImpl`
2. `RateLimiterServiceImpl`
3. `MarketServiceImpl`
4. `ProviderFactory`
5. `DataConverter`
6. `USStockMockDataProvider`
7. `SymbolUtils`
8. `CollectionCopyUtils`

阈值配置保持：

- `LINE COVEREDRATIO minimum = 0.60`
- `BRANCH COVEREDRATIO minimum = 0.40`

## 3. 复验命令与结果

### 3.1 连续三次门禁复验

```bash
mvn -q -f koduck-backend/pom.xml test
mvn -q -f koduck-backend/pom.xml test
mvn -q -f koduck-backend/pom.xml test
```

结果：三次均通过（本地执行日志路径：`/tmp/p3_mvn_test_1.log`、`/tmp/p3_mvn_test_2.log`、`/tmp/p3_mvn_test_3.log`）。

### 3.2 核心类覆盖率（用于 P3-02 联动验收）

数据源：`koduck-backend/target/site/jacoco/jacoco.csv`

| 类 | Line 覆盖率 | Branch 覆盖率 |
|---|---:|---:|
| `MarketServiceImpl` | 78.8% | 72.1% |
| `PortfolioServiceImpl` | 91.7% | 67.9% |
| `AiAnalysisServiceImpl` | 93.8% | 72.9% |

## 4. DoD 对照

- [x] JaCoCo 门禁范围扩大（3 类 -> 8 类）
- [x] 每次扩围有可复验命令与结果
- [x] `mvn -q -f koduck-backend/pom.xml test` 持续通过
- [x] 阈值不降低（line>=60%, branch>=40%）

## 5. 备注

本记录以仓库当前 `pom.xml` 和本地复验结果为准，替代此前历史版本中“10 类+40/25 阈值”的过时描述。
