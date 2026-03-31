# P2-04: PMD 非阻断项治理开发指南

## 任务目标
分批治理 PMD 非阻断项，先处理高价值规则，目标下降 >= 30%。

## 开发步骤

### 1. 查看当前 PMD 报告

```bash
cd koduck-backend
mvn pmd:pmd
open target/pmd.html
```

### 2. 分析规则优先级

按影响排序处理：

| 优先级 | 规则族 | 说明 | 处理策略 |
|--------|--------|------|----------|
| P0 | UnusedImports | 未使用导入 | 自动修复 |
| P0 | UnnecessaryModifier | 多余修饰符 | 自动修复 |
| P1 | UnusedPrivateMethod | 未使用私有方法 | 删除或标记 |
| P1 | UnusedLocalVariable | 未使用局部变量 | 删除 |
| P2 | SimplifiedTernary | 简化三元表达式 | 重构 |
| P2 | UselessParentheses | 多余括号 | 简化 |
| P3 | CommentRequired | 缺少注释 | 补充文档 |

### 3. 分批处理策略

#### 第一批（低风险，自动修复）

创建修复脚本 `scripts/fix-pmd-batch1.sh`：

```bash
#!/bin/bash
# 自动修复简单问题

echo "=== 修复 UnusedImports ==="
# 使用 IDE 或 sed 批量移除未使用导入
find src -name "*.java" -exec grep -l "unused import" {} \;

echo "=== 修复 UnnecessaryModifier ==="
# 移除 interface 中的 public static final 等冗余修饰符
```

#### 第二批（需人工审核）

```bash
# 生成待审核清单
mvn pmd:pmd -Dpmd.printFailingErrors=true 2>&1 | grep -E "(UnusedPrivate|UnusedLocal)" > /tmp/pmd-review.txt
echo "需人工审核的问题："
cat /tmp/pmd-review.txt
```

### 4. 配置 PMD 规则分级

修改 `pom.xml` 中的 PMD 配置：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-pmd-plugin</artifactId>
    <configuration>
        <rulesets>
            <ruleset>rulesets/pmd-base.xml</ruleset>
        </rulesets>
        <!-- 第一批治理：降低阈值 -->
        <minimumTokens>50</minimumTokens>
        <targetJdk>23</targetJdk>
    </configuration>
</plugin>
```

### 5. 记录延期项

创建 `docs/static-analysis.md`：

```markdown
## PMD 治理记录

### Phase 2 第一批治理 (目标: -30%)

#### 已处理规则
- [x] UnusedImports: 修复 45 处
- [x] UnnecessaryModifier: 修复 23 处
- [x] UnusedLocalVariable: 修复 18 处

#### 延期处理（需业务评估）
| 规则 | 位置 | 延期原因 | 计划时间 |
|------|------|----------|----------|
| UnusedPrivateMethod | AiAnalysisService | 可能后续使用 | Phase 3 |
| CommentRequired | MarketController | 待API稳定后补充 | Phase 3 |

### 治理前后对比
- 治理前: XXX 个非阻断项
- 治理后: XXX 个非阻断项
- 下降比例: XX%
```

### 6. 增量检查

配置 CI 只检查新增代码：

```yaml
# .github/workflows/pmd-pr.yml
name: PMD PR Check
on: [pull_request]

jobs:
  pmd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run PMD on changed files
        run: |
          cd koduck-backend
          # 只对修改的文件运行 PMD
          git diff --name-only origin/dev | grep "\\.java$" > changed_files.txt
          mvn pmd:check -Dpmd.includesFile=changed_files.txt
```

## 验收标准
- [ ] PMD 非阻断总量下降 >= 30%
- [ ] 无新增阻断级问题
- [ ] 延期项有明确责任人与时间窗口
- [ ] 文档记录完整

## 注意事项
- ⚠️ 不要一次性修改太多文件，分批提交 PR
- ⚠️ 每个批次单独测试确保无回归
- ⚠️ 复杂重构先写测试再修改
