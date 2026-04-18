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

## 手动装载工具

仓库内提供了一个独立脚本工具 [tools/koduck-knowledge-dev-loader](/Users/guhailin/Git/koduck-quant/tools/koduck-knowledge-dev-loader)，
用于手动向 `koduck-dev` 环境的 `koduck_knowledge` PostgreSQL 与 MinIO 写入数据。

这个工具只负责执行你给定的 SQL 或对象上传，不做业务数据校验。

同时也提供了一个独立删除工具 [tools/koduck-knowledge-dev-cleaner](/Users/guhailin/Git/koduck-quant/tools/koduck-knowledge-dev-cleaner)，
用于手动删除 PostgreSQL 记录和 MinIO 对象。

现成 SQL 模板：

- [entity-load-template.sql](/Users/guhailin/Git/koduck-quant/koduck-knowledge/scripts/sql/entity-load-template.sql)
- [entity-delete-template.sql](/Users/guhailin/Git/koduck-quant/koduck-knowledge/scripts/sql/entity-delete-template.sql)

示例：

```bash
# 执行单条 SQL
./tools/koduck-knowledge-dev-loader db-sql \
  --sql "insert into entity (entity_id, canonical_name, type) values (100, '贵州茅台', 'stock');"

# 执行本地 SQL 文件
./tools/koduck-knowledge-dev-loader db-file --file /tmp/knowledge-load.sql

# 上传本地 JSON 到 MinIO，并输出对应 s3:// URI
./tools/koduck-knowledge-dev-loader s3-put \
  --file /tmp/basic.json \
  --bucket knowledge \
  --key basic/100/BASIC/20250101T000000Z.json

# 从 stdin 直接上传对象
cat /tmp/profile.json | ./tools/koduck-knowledge-dev-loader s3-put-stdin \
  --bucket knowledge \
  --key profile/100/BIO/1.json

# 执行删除 SQL 文件
./tools/koduck-knowledge-dev-cleaner db-file \
  --file ./koduck-knowledge/scripts/sql/entity-delete-template.sql

# 删除单个对象
./tools/koduck-knowledge-dev-cleaner s3-rm \
  --bucket knowledge \
  --key profile/100/BIO/1.json

# 删除整个前缀
./tools/koduck-knowledge-dev-cleaner s3-rm-prefix \
  --bucket knowledge \
  --prefix profile/100/
```

默认约定：

- Namespace: `koduck-dev`
- PostgreSQL: `dev-postgres` 对应的 `koduck_knowledge`
- MinIO: `http://dev-minio:9000`
- 默认 bucket: `knowledge`

## 边界说明

事实构建、数据导入与治理链路不在 `koduck-knowledge` 服务内完成。
当前服务只消费已经写入 PostgreSQL 的只读查询模型，并返回原始知识 URI。
