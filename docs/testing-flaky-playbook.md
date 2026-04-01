# Flaky Test 治理手册

> 本文档定义 koduck-backend 的 flaky test 判定标准、检测方法、处理流程与预防机制。
>
> **版本**: 1.0  
> **最后更新**: 2026-04-01  
> **适用范围**: koduck-backend Java 后端服务

---

## 1. Flaky 定义

**Flaky Test（不稳定测试）** 是指在同一代码版本下，非确定性失败的测试。表现为：

- 相同的代码，多次运行结果不一致（时而过，时而失败）
- 失败原因与外部环境因素（时间、网络、并发、资源竞争）相关
- 与代码逻辑本身无关，重试可能通过

### Flaky 的危害

| 危害 | 说明 |
|------|------|
| 信任危机 | 开发者对 CI/CD 失去信任，开始无视失败 |
| 效率降低 | 反复重试浪费时间和资源 |
| 掩盖真问题 | 真正的 bug 被淹没在 flaky 噪音中 |
| 交付延迟 | 阻塞发布流程，延长交付周期 |

---

## 2. 判定标准

### 2.1 判定条件（满足任一即认定为 flaky）

| 条件 | 说明 | 示例 |
|------|------|------|
| **结果不一致** | 同一代码，连续 3 次运行结果不同 | 第1次失败，第2次通过，第3次失败 |
| **环境依赖** | 失败与外部环境因素相关 | 时间、网络、并发、文件系统状态 |
| **非确定性** | 无法 100% 复现的失败 | 偶发性失败，无明显代码缺陷 |
| **重试通过** | 失败后重试能通过 | CI 中首次失败，重试后通过 |

### 2.2 排除条件（以下情况**不是** flaky）

- ✅ 代码变更导致的失败（逻辑错误）
- ✅ 依赖服务不可用（基础设施问题）
- ✅ 测试数据变更导致的失败（预期内变化）

---

## 3. 检测方法

### 3.1 本地检测

#### 单次测试重复运行

```bash
# 方式1：Maven Surefire 自动重试
mvn test -Dtest=MyFlakyTest -Dsurefire.rerunFailingTestsCount=3

# 方式2：手动循环运行（Linux/Mac）
for i in {1..10}; do
  echo "=== Run $i ==="
  mvn test -Dtest=MyFlakyTest || echo "FAILED on run $i"
done

# 方式3：使用 Maven 重复执行插件
cd koduck-backend
mvn test -Dtest=MyFlakyTest -Dsurefire.repeat=10
```

#### 批量检测（CI 前置检查）

```bash
# 运行所有测试，启用自动重试并记录
cd koduck-backend
mvn test -Dsurefire.rerunFailingTestsCount=2 \
  -Dsurefire.reportFormat=xml \
  -Dsurefire.printSummary=false
```

### 3.2 CI 监控

#### GitHub Actions 集成

CI 工作流已配置测试报告收集（详见 `.github/workflows/ci-quality-gate.yml`）：

```yaml
- name: Run backend tests
  run: |
    set -euo pipefail
    mvn -f koduck-backend/pom.xml -B clean test \
      -Dsurefire.rerunFailingTestsCount=2  # 自动重试 2 次
```

#### 重试报告分析

CI 会自动上传测试报告到 Artifact，可下载分析：

```bash
# 查看重试记录
cat target/surefire-reports/*.xml | grep -E "(flaky|rerun|retry)"
```

### 3.3 Flaky 追踪工具

#### Maven Surefire 报告

Surefire 3.x 自动识别并报告 flaky 测试：

```xml
<!-- 在 surefire-report.html 中查找 flaky 标签 -->
<testcase name="testAsyncOperation">
  <flakyFailure message="Assertion failed">
    <!-- 首次失败 -->
  </flakyFailure>
  <rerunFailure message="Assertion failed">
    <!-- 重试失败 -->
  </rerunFailure>
</testcase>
```

---

## 4. 处理流程

### 4.1 发现 Flaky 后的立即行动

```
发现 Flaky Test
      ↓
  [1] 标记隔离 ─────────────────────┐
      ↓                            │
  [2] 创建修复 Issue (标签: flaky)    │
      ↓                            │
  [3] 指定 Owner                    │
      ↓                            │
  [4] 修复并验证 (连续10次通过)        │
      ↓                            │
  [5] 解除标记，关闭 Issue ◄───────────┘
```

### 4.2 详细步骤

#### Step 1: 立即标记隔离

```java
// 方式1：使用 @Disabled 临时禁用（不推荐长期使用）
@Disabled("Flaky test - see issue #XXX")
@Test
void testAsyncOperation() { }

// 方式2：使用 @Tag("flaky") 分类运行（推荐）
@Tag("flaky")
@Test
void testAsyncOperation() { }
```

**配置 Maven 排除 flaky 测试：**

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <excludedGroups>flaky</excludedGroups>
    </configuration>
</plugin>
```

#### Step 2: 创建修复 Issue

使用模板创建 flaky 修复任务：

```markdown
## Flaky Test: {TestClassName}.{methodName}

### 现象
- 失败频率: X/10 次
- 失败环境: CI / 本地 / 两者
- 错误信息: `{错误堆栈}`

### 初步分析
- 可能原因: [异步/时间/并发/资源竞争]
- 相关代码: [链接]

### 修复方案
- [ ] 方案1: [简述]
- [ ] 方案2: [简述]

### 验收标准
- [ ] 连续 10 次本地运行通过
- [ ] CI 连续 5 次构建通过
- [ ] 代码审查通过

### Owner
@{github-username}
```

#### Step 3: 修复验证

修复后必须验证稳定性：

```bash
# 本地验证：连续 10 次通过
cd koduck-backend
for i in {1..10}; do
  mvn test -Dtest=FixedTest -q || { echo "FAILED on run $i"; exit 1; }
done
echo "✅ 连续 10 次通过"

# CI 验证：通过 flaky-tracker 工作流触发
# 见 .github/workflows/flaky-tracker.yml
```

### 4.3 修复优先级

| 级别 | 条件 | 响应时间 | 处理方式 |
|------|------|----------|----------|
| P0 | 阻塞主分支/发布 | 2 小时内 | 立即禁用 + 紧急修复 |
| P1 | 影响 PR 合并 | 1 天内 | 标记隔离 + 尽快修复 |
| P2 | 偶发失败 | 1 周内 | 排期修复 |

---

## 5. 预防机制

### 5.1 编码规范（DO vs DON'T）

#### ❌ 禁止使用

```java
// ❌ 禁止：Thread.sleep 固定等待
@Test
void testAsync() throws InterruptedException {
    service.asyncOperation();
    Thread.sleep(1000); // 不稳定！
    assertEquals(expected, actual);
}

// ❌ 禁止：依赖当前时间
@Test
void testTimeBased() {
    long now = System.currentTimeMillis(); // 不稳定！
    assertTrue(now > 0);
}

// ❌ 禁止：依赖随机数
@Test
void testRandom() {
    int value = new Random().nextInt(100); // 不稳定！
    assertTrue(value >= 0);
}

// ❌ 禁止：固定端口（可能导致冲突）
@SpringBootTest(webEnvironment = WebEnvironment.DEFINED_PORT)
class BadTest { }

// ❌ 禁止：共享可变状态
private static int counter = 0; // 测试间耦合！

// ❌ 禁止：外部服务真实调用
@Test
void testExternalAPI() {
    RestTemplate rest = new RestTemplate();
    ResponseEntity<String> resp = rest.getForEntity(
        "https://api.external.com/data", String.class); // 网络依赖！
}
```

#### ✅ 推荐做法

```java
// ✅ 推荐：使用 Awaitility 等待异步结果
@Test
void testAsync() {
    service.asyncOperation();
    await().atMost(Duration.ofSeconds(5))
           .pollInterval(Duration.ofMillis(100))
           .untilAsserted(() -> assertEquals(expected, actual));
}

// ✅ 推荐：注入 Clock 控制时间
@Test
void testTimeBased() {
    Clock fixedClock = Clock.fixed(
        Instant.parse("2024-01-01T00:00:00Z"), ZoneId.of("UTC"));
    // 测试中使用 fixedClock
}

// ✅ 推荐：使用随机种子或 Mock
@Test
void testRandom() {
    Random seededRandom = new Random(12345L); // 固定种子
    // 或使用 Mockito 模拟
}

// ✅ 推荐：随机端口
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class GoodTest { }

// ✅ 推荐：每个测试独立数据
@Transactional
@Test
void testWithIsolation() {
    // 数据自动回滚
}

// ✅ 推荐：Mock 外部依赖
@MockBean
private ExternalService externalService;

@Test
void testExternalAPI() {
    when(externalService.fetchData()).thenReturn(mockData);
    // 测试业务逻辑
}
```

### 5.2 测试设计原则

| 原则 | 说明 | 实施方法 |
|------|------|----------|
| **确定性** | 相同输入必有相同输出 | 固定种子、Mock 外部依赖 |
| **隔离性** | 测试间互不影响 | @Transactional、独立数据 |
| **快速性** | 执行时间短 | 避免真实等待、使用切片测试 |
| **可重复** | 任意顺序、任意次数运行通过 | 无共享状态、清理资源 |

### 5.3 代码审查检查清单

审查测试代码时检查：

- [ ] 没有 `Thread.sleep`
- [ ] 异步操作使用 Awaitility
- [ ] 没有直接使用 `System.currentTimeMillis()` 或 `new Date()`
- [ ] 随机数使用固定种子或 Mock
- [ ] 外部依赖已 Mock（@MockBean）
- [ ] 数据库测试有 @Transactional 或清理逻辑
- [ ] 没有静态可变状态共享
- [ ] 使用 RANDOM_PORT 而非 DEFINED_PORT

---

## 6. Flaky 清单

### 当前状态：🟢 无已知 Flaky

> 最后扫描: 2026-04-01  
> 扫描范围: koduck-backend 全部测试（约 69 个）

| 测试类 | 方法 | 状态 | Issue | Owner | 备注 |
|--------|------|------|-------|-------|------|
| - | - | 🟢 健康 | - | - | 无已知 flaky |

### 历史记录

| 测试类 | 方法 | 发现日期 | 修复日期 | 原因 | 修复方案 |
|--------|------|----------|----------|------|----------|
| - | - | - | - | - | - |

---

## 7. CI 集成配置

### 7.1 Maven Surefire 配置

`koduck-backend/pom.xml` 已启用自动重试：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <!-- 失败测试自动重试 2 次 -->
        <rerunFailingTestsCount>2</rerunFailingTestsCount>
        
        <!-- 生成详细 XML 报告 -->
        <reportFormat>xml</reportFormat>
        
        <!-- 失败时保留输出 -->
        <trimStackTrace>false</trimStackTrace>
        <printSummary>true</printSummary>
    </configuration>
</plugin>
```

### 7.2 Flaky Tracker 工作流

`.github/workflows/flaky-tracker.yml` 提供：

- 定期全量测试扫描
- Flaky 检测与报告
- 趋势追踪

---

## 8. 工具与资源

### 8.1 常用命令

```bash
# 检测单个测试是否 flaky
cd koduck-backend
./scripts/detect-flaky.sh MyTestClass

# 运行排除 flaky 的测试
mvn test -DexcludedGroups=flaky

# 仅运行 flaky 测试
mvn test -Dgroups=flaky

# 生成测试报告
mvn surefire-report:report
open target/site/surefire-report.html
```

### 8.2 相关文档

- [测试策略与分层规范](./testing-strategy.md)
- [CI Quality Gate 配置](../.github/workflows/ci-quality-gate.yml)
- [Flaky Tracker 工作流](../.github/workflows/flaky-tracker.yml)

---

## 9. 责任与度量

### 9.1 角色职责

| 角色 | 职责 |
|------|------|
| **测试作者** | 确保新测试不是 flaky，遵循预防规范 |
| **代码审查者** | 审查时检查 flaky 风险点 |
| **CI 监控** | 自动检测并报告 flaky |
| **模块 Owner** | 负责修复分配给本模块的 flaky |

### 9.2 度量指标

| 指标 | 目标 | 监控方式 |
|------|------|----------|
| Flaky 测试数 | = 0 | 每周扫描 |
| Flaky 引入率 | < 1% | 月度统计 |
| 平均修复时间 | < 3 天 | Issue 追踪 |
| CI 稳定性 | > 99% | 构建成功率 |

### 9.3 持续改进

每月 flaky 治理回顾：

1. 统计本月发现的 flaky 数量
2. 分析根本原因（分类统计）
3. 更新预防规范
4. 分享典型案例

---

## 附录

### A. 参考链接

- [Google Testing Blog: Where do our flaky tests come from?](https://testing.googleblog.com/2017/04/where-do-our-flaky-tests-come-from.html)
- [JUnit 5 User Guide](https://junit.org/junit5/docs/current/user-guide/)
- [Awaitility Wiki](https://github.com/awaitility/awaitility/wiki)
- [Maven Surefire Plugin](https://maven.apache.org/surefire/maven-surefire-plugin/)

### B. 术语表

| 术语 | 定义 |
|------|------|
| Flaky Test | 非确定性测试，同一代码下结果不稳定 |
| Rerun | 失败后自动重新执行测试 |
| Deterministic | 确定性，相同输入必有相同输出 |
| Isolation | 隔离性，测试间互不干扰 |
