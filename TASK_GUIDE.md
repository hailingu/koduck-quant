# P2-01: JaCoCo 覆盖率门禁开发指南

## 任务目标
接入 JaCoCo，建立覆盖率门禁并纳入 CI。

## 开发步骤

### 1. 修改 pom.xml 添加 JaCoCo 插件

在 `<plugins>` 部分添加：

```xml
<!-- JaCoCo 代码覆盖率 -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.12</version>
    <executions>
        <!-- 测试前准备 agent -->
        <execution>
            <id>prepare-agent</id>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <!-- 测试后生成报告 -->
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
        <!-- 覆盖率检查 -->
        <execution>
            <id>check</id>
            <phase>test</phase>
            <goals>
                <goal>check</goal>
            </goals>
            <configuration>
                <rules>
                    <rule>
                        <element>BUNDLE</element>
                        <limits>
                            <limit>
                                <counter>LINE</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.60</minimum>
                            </limit>
                        </limits>
                    </rule>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

### 2. 添加 JaCoCo 属性到 properties

```xml
<jacoco.version>0.8.12</jacoco.version>
<jacoco.line.minimum>0.60</jacoco.line.minimum>
```

### 3. 配置排除项（entity/dto/config 等）

在 check execution 中添加：

```xml
<configuration>
    <excludes>
        <!-- 排除无需测试的类 -->
        <exclude>**/entity/**</exclude>
        <exclude>**/dto/**</exclude>
        <exclude>**/config/**</exclude>
        <exclude>**/KoduckApplication.class</exclude>
    </excludes>
    <!-- 规则配置 -->
</configuration>
```

### 4. 本地验证

```bash
mvn clean test
# 查看报告
open target/site/jacoco/index.html
```

### 5. GitHub Actions CI 配置

创建 `.github/workflows/coverage-gate.yml`：

```yaml
name: Coverage Gate

on:
  pull_request:
    branches: [dev, main]
  push:
    branches: [dev]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 23
        uses: actions/setup-java@v4
        with:
          java-version: '23'
          distribution: 'temurin'
      - name: Run tests with coverage
        run: cd koduck-backend && mvn clean test jacoco:report
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: jacoco-report
          path: koduck-backend/target/site/jacoco/
      - name: Check coverage threshold
        run: cd koduck-backend && mvn jacoco:check
```

### 6. 文档

创建 `docs/testing-strategy.md` 中的 JaCoCo 章节。

## 验收标准
- [ ] `mvn test` 产出 JaCoCo 报告
- [ ] CI 可查看覆盖率产物
- [ ] PR 未达 60% 阈值被阻断
- [ ] 文档更新完成
