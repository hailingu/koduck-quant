# ADR-0006: Dev 环境 PostgreSQL 部署

- Status: Accepted
- Date: 2026-04-08
- Issue: #640

## Context

koduck-auth 服务需要 PostgreSQL 数据库来持久化用户数据、刷新令牌等信息。当前 dev 环境的部署脚本 `./k8s/deploy.sh dev install` 并没有部署 PostgreSQL，而是采用了一种降级方案：

```bash
if ! kubectl -n "${NAMESPACE}" get svc postgres >/dev/null 2>&1; then
    echo -e "${YELLOW}未检测到 postgres Service，启用 koduck-auth 无数据库启动模式...${NC}"
    kubectl -n "${NAMESPACE}" set env deploy/"${ENV}-koduck-auth" KODUCK_AUTH_SKIP_DB_ON_BOOT=true
fi
```

这种方案的问题是：
1. **功能不完整**: koduck-auth 无法执行数据库迁移和持久化数据
2. **测试受限**: 无法在 dev 环境测试数据库相关功能
3. **与生产差异大**: 生产环境使用真实数据库，dev 环境缺少这部分验证

## Decision

### 部署策略

在 dev 环境的 K8s 部署中添加 PostgreSQL StatefulSet，包括：

1. **PostgreSQL StatefulSet**: 使用官方 postgres:15-alpine 镜像
2. **PersistentVolumeClaim**: 1Gi 存储（使用 hostpath 存储类）
3. **Service**: 暴露 postgres 服务供 koduck-auth 连接
4. **Secret**: 存储数据库用户名和密码

### 资源配置

```yaml
# PostgreSQL StatefulSet
 replicas: 1
 image: postgres:15-alpine
 resources:
   requests:
     cpu: 100m
     memory: 128Mi
   limits:
     cpu: 500m
     memory: 512Mi
 storage: 1Gi
```

### 数据库连接

koduck-auth 通过以下方式连接 PostgreSQL：

```yaml
env:
  - name: KODUCK_AUTH__DATABASE__URL
    valueFrom:
      secretKeyRef:
        name: koduck-auth-secrets
        key: database-url
```

默认连接字符串：
```
postgresql://koduck:koduck_secret@postgres:5432/koduck_auth
```

### 数据持久化

使用 PVC 实现数据持久化：
- 存储类: `hostpath`（dev 环境）
- 容量: 1Gi
- 访问模式: ReadWriteOnce

### 部署顺序

```
1. 创建 postgres Secret
2. 创建 postgres PVC
3. 部署 postgres StatefulSet
4. 等待 postgres Ready
5. 部署 koduck-auth（带数据库连接）
6. 执行数据库迁移（koduck-auth 启动时自动执行）
```

## Consequences

### 正向影响

1. **功能完整性**: koduck-auth 可以正常使用数据库功能
2. **开发体验**: 开发者可以在本地测试完整的认证流程
3. **一致性**: dev 和 prod 环境的架构更接近
4. **数据持久化**: 重启后数据不会丢失

### 代价与风险

1. **资源占用**: 额外占用约 128Mi 内存
2. **启动时间**: 部署时间增加约 10-20 秒（等待 postgres 启动）
3. **存储要求**: 需要 1Gi 的磁盘空间

### 兼容性影响

- **向后兼容**: koduck-auth 的配置无需修改
- **数据迁移**: 首次部署需要创建数据库表（由 koduck-auth 自动执行）

## Alternatives Considered

### 1. 使用外部 PostgreSQL

- **方案**: 使用 Docker Compose 或宿主机的 PostgreSQL
- **拒绝理由**: 增加开发环境复杂度，与 K8s 部署理念不符

### 2. 使用 SQLite

- **方案**: koduck-auth 使用 SQLite 作为 dev 环境数据库
- **拒绝理由**: 与生产环境差异大，某些 SQL 特性不支持

### 3. 继续使用无数据库模式

- **方案**: 保留现有的 KODUCK_AUTH_SKIP_DB_ON_BOOT 方案
- **拒绝理由**: 功能受限，无法测试完整业务流程

## Implementation Plan

1. 创建 `k8s/base/postgres.yaml` - PostgreSQL StatefulSet 和 Service
2. 创建 `k8s/overlays/dev/postgres.yaml` - Dev 环境特定配置（资源限制等）
3. 修改 `k8s/overlays/dev/kustomization.yaml` - 添加 PostgreSQL 资源
4. 修改 `k8s/deploy.sh` - 部署 PostgreSQL 并等待其就绪
5. 更新 `k8s/base/koduck-auth.yaml` - 确保数据库连接配置正确

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 2.2
- PostgreSQL Docker: https://hub.docker.com/_/postgres
- K8s StatefulSet: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
