# Koduck Knowledge

`koduck-knowledge` 是一个只读的实体知识查询服务，负责按 `entity`、`basic profile`、
`profile detail`、`history` 这几类 northbound 查询接口对外提供能力。

当前 MVP 只做查询，不做以下事情：

- 不做事实构建、数据装载、审核、发布或写入链路
- 不做对象存储内容读取，只返回数据库里保存的 `s3://...` URI
- 不做向量检索、模糊召回、拼音近似、编辑距离匹配
- 不在服务内执行 JWT 验签，网关身份由 APISIX 注入头部后透传

## 依赖

- Java 23
- Maven 3.9+
- PostgreSQL 15+
- Docker（用于统一构建镜像）

## 本地启动

1. 准备数据库，并创建 `koduck_knowledge` 数据库。
2. 配置环境变量：

```bash
export KODUCK_KNOWLEDGE_DB_URL=jdbc:postgresql://localhost:5432/koduck_knowledge
export KODUCK_KNOWLEDGE_APP_DB_USER=koduck
export KODUCK_KNOWLEDGE_APP_DB_PASSWORD=koduck
```

3. 启动服务：

```bash
mvn -f koduck-knowledge/pom.xml spring-boot:run
```

默认端口为 `8084`，Swagger UI 路径为 `/swagger-ui.html`。

## 测试

单元测试与集成测试：

```bash
mvn -f koduck-knowledge/pom.xml test
mvn -f koduck-knowledge/pom.xml verify
```

集成测试基于 Testcontainers PostgreSQL，不依赖外部 MinIO。

## 配置

核心配置项：

- `KODUCK_KNOWLEDGE_DB_URL`
- `KODUCK_KNOWLEDGE_APP_DB_USER`
- `KODUCK_KNOWLEDGE_APP_DB_PASSWORD`
- `SERVER_PORT`

日志默认走 `log4j2.xml`，生产配置输出 JSON；本地 profile 可切到
`log4j2-local.xml` 查看更易读的文本日志。

## Docker 构建

统一通过 Docker 构建，避免本地裸机构建差异：

```bash
./koduck-knowledge/scripts/build.sh --profile jvm
./koduck-knowledge/scripts/build.sh --profile native
```

- `native` 是默认发布 profile
- `jvm` 是回退 profile

## 部署

K8s 资源位于仓库 `k8s/` 目录，knowledge 服务通过 APISIX 显式注册
`/api/v1/entities/*` 路由。

```bash
./k8s/deploy.sh dev
./k8s/uninstall.sh dev
```

部署依赖：

- PostgreSQL
- APISIX

可选样例能力：

- MinIO 仅作为对象路径样例环境，不是当前 MVP 启动前置条件

## 边界说明

事实构建、数据导入与治理链路不在 `koduck-knowledge` 服务内完成。
当前服务只消费已经写入 PostgreSQL 的只读查询模型，并返回原始知识 URI。
