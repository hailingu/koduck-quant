# ADR-0140: Dockerfile 多模块适配

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

随着架构改进，项目已从单模块变为多模块 Maven 项目。当前 Dockerfile 需要更新以支持多模块构建，优化构建缓存和镜像大小。

## 当前问题

1. **单模块结构**: 当前 Dockerfile 假设项目为单模块结构
2. **缓存未优化**: 没有充分利用 Docker 层缓存
3. **缺少 .dockerignore**: 可能复制不必要的文件到构建上下文

## 决策

### 1. 使用多阶段构建

采用多阶段构建策略：
- **Builder 阶段**: 使用 Maven 镜像编译项目
- **Runtime 阶段**: 使用轻量级 JRE 镜像运行应用

### 2. 优化层缓存

构建步骤：
1. 先复制所有 pom.xml 文件
2. 下载依赖（利用 Docker 缓存层）
3. 复制源码
4. 构建应用

### 3. 更新 .dockerignore

排除不需要的文件：
- IDE 配置文件
- 文档
- 测试文件
- 构建产物

## 实现策略

### Dockerfile 结构

```dockerfile
# Stage 1: Build
FROM maven:3.9.9-eclipse-temurin-23-alpine AS builder
WORKDIR /build

# Copy all pom.xml files first for dependency caching
COPY pom.xml .
COPY koduck-bom/pom.xml koduck-bom/
COPY koduck-common/pom.xml koduck-common/
# ... copy all module pom.xml

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source code
COPY . .

# Build
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:23-jre-alpine
# ... runtime configuration
COPY --from=builder /build/koduck-bootstrap/target/*.jar app.jar
```

### 关键优化点

1. **分层复制**: 先复制 pom.xml，再复制源码
2. **依赖缓存**: `mvn dependency:go-offline` 利用缓存层
3. **轻量级运行**: 使用 JRE 而非 JDK 镜像
4. **非 root 用户**: 使用 koduck 用户运行应用

## 权衡

### 优点

1. **构建速度**: 依赖层缓存，源码变更不触发重新下载依赖
2. **镜像大小**: 多阶段构建减小最终镜像
3. **安全性**: 使用非 root 用户运行

### 缺点

1. **复杂性**: 多模块 Dockerfile 更复杂
2. **维护成本**: 新增模块需要更新 Dockerfile

## 兼容性影响

### 对现有部署的影响

- 镜像构建命令不变
- 运行时行为不变
- 环境变量配置不变

### 迁移步骤

1. 更新 Dockerfile
2. 更新 .dockerignore
3. 测试构建
4. 验证运行

## 相关文档

- Issue #604

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
