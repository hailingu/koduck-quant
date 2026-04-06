# 质量检查使用指南

## 快速开始

### 一键质量检查

```bash
# 在项目根目录执行
make quality

# 或在 koduck-backend 目录执行
./scripts/quality-check.sh
```

### 分项检查

```bash
# PMD 静态分析
make quality-pmd

# PMD 存量非回退检查（Ratchet）
make quality-pmd-debt

# SpotBugs 安全检查
make quality-spotbugs

# 运行测试
make quality-test

# 覆盖率检查
make quality-coverage

# 架构检查
make quality-arch
```

### 安装 pre-commit 质量门禁

```bash
# 在仓库根目录执行（推荐）
make hooks-install

# 等价命令
./scripts/install-git-hooks.sh
```

安装后，提交前会自动触发 `.githooks/pre-commit`。若暂时不需要可执行：

```bash
make hooks-uninstall
```

## 质量检查流程

```
┌─────────────────────────────────────────────────────────────┐
│  1. PMD 代码格式检查                                        │
│     → 检查代码规范、潜在问题                                │
├─────────────────────────────────────────────────────────────┤
│  2. PMD 存量非回退检查                                      │
│     → 确保存量违规总数不高于基线                            │
├─────────────────────────────────────────────────────────────┤
│  3. SpotBugs 安全漏洞检查                                   │
│     → 检查常见安全漏洞                                      │
├─────────────────────────────────────────────────────────────┤
│  4. Maven 编译检查                                          │
│     → 确保代码可编译                                        │
├─────────────────────────────────────────────────────────────┤
│  5. 单元测试                                                │
│     → 纯 Java 测试 (Mockito)                                │
├─────────────────────────────────────────────────────────────┤
│  6. 切片测试                                                │
│     → @WebMvcTest, @DataJpaTest                             │
├─────────────────────────────────────────────────────────────┤
│  7. JaCoCo 覆盖率检查                                       │
│     → 行覆盖率 >= 60%                                       │
├─────────────────────────────────────────────────────────────┤
│  8. 架构违规检查                                            │
│     → 检查跨层依赖违规                                      │
└─────────────────────────────────────────────────────────────┘
```

## 检查失败处理

### PMD 检查失败

```bash
# 查看详细报告
mvn pmd:pmd
open koduck-backend/target/pmd.html
```

常见修复：
- 未使用导入: IDE 自动优化导入
- 变量命名: 遵循驼峰命名规范
- 复杂度: 拆分过长方法

### SpotBugs 检查失败

```bash
# 查看详细报告
mvn spotbugs:spotbugs
mvn spotbugs:gui  # 图形界面
```

### 测试失败

```bash
# 运行单个测试
mvn test -Dtest=UserServiceTest

# 运行失败的测试
mvn test -Dtest=*Test#failedMethod
```

### 覆盖率不足

```bash
# 查看覆盖率报告
mvn jacoco:report
open koduck-backend/target/site/jacoco/index.html
```

提升覆盖率方法：
1. 为未覆盖的分支添加测试
2. 排除不需要测试的类（entity/dto/config）
3. 使用 @Generated 排除自动生成代码

## CI 集成

GitHub Actions 已配置，PR 会自动运行：

- ✅ 编译检查
- ✅ 测试执行
- ✅ 覆盖率检查
- ✅ PMD 检查
- ✅ PMD 存量非回退检查
- ✅ SpotBugs 检查

## 最佳实践

### 提交前检查

```bash
# 1. 拉取最新代码
git pull origin dev

# 2. 确认已安装 pre-commit hook（首次执行）
make hooks-install

# 3. 运行质量检查
make quality

# 4. 检查通过后再提交（commit 时会再次自动执行门禁）
git add .
git commit -m "feat: your change"
git push origin your-branch
```

### PR 提交流程

1. 创建分支：`feature/your-feature`
2. 开发并本地测试
3. 运行 `make quality` 确保通过
4. 提交 PR，填写 PR 模板
5. 等待 CI 通过
6. 代码审查
7. 合并到 dev

## 质量指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 测试通过率 | 100% | - |
| 行覆盖率 | >= 60% | - |
| PMD 非阻断项 | 持续下降 | 9951 |
| SpotBugs 阻断问题 | 0 | 0 |
| 架构违规 | 0 | 0 |
