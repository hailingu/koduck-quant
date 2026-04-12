# ADR-4001: koduck-memory K8s 部署集成方案

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-12
- **作者**: @hailingu
- **相关**: #839, docs/design/koduck-memory-for-koduck-ai.md (13.3), docs/implementation/koduck-memory-koduck-ai-tasks.md (Task 8.2)

---

## 背景与问题陈述

`koduck-memory` 服务和 MinIO 对象存储已有独立的 K8s manifests（`k8s/base/koduck-memory.yaml`、`k8s/base/minio.yaml`），但现有的 `k8s/deploy.sh` 和 `k8s/uninstall.sh` 脚本主要服务于 APISIX 网关基础设施，尚未集成 memory-service 的完整生命周期管理。

我们需要将 koduck-memory 和 MinIO 的部署、初始化和清理纳入统一脚本入口，同时确保 dev/prod 环境共用同一套脚本。

### 上下文

- **业务背景**: koduck-memory 是 koduck-ai 的 southbound gRPC 服务，负责会话元数据真值、记忆写入与检索
- **技术背景**: MinIO 作为 dev 环境对象存储，需要 bucket 初始化 Job；koduck-memory 依赖 PostgreSQL 数据库和对象存储，部署时需要等待依赖就绪

---

## 决策驱动因素

1. **统一入口**: dev/prod 共用同一 `deploy.sh`/`uninstall.sh`，降低运维认知成本
2. **依赖顺序**: koduck-memory 依赖 PostgreSQL（需先创建数据库）和 MinIO（需先初始化 bucket），部署顺序必须正确
3. **幂等性**: 重复执行 install 不会导致资源重复创建或状态异常
4. **与现有模式一致**: 遵循现有 `ensure_*` 函数模式和 `wait_pods_ready` 机制

---

## 考虑的选项

### 选项 1: 在现有 deploy.sh/uninstall.sh 中集成

**描述**: 扩展现有脚本的 `install()` 函数，增加 koduck-memory 和 MinIO 的等待、数据库创建和 bucket 初始化逻辑

**优点**:
- 单一入口，与现有 APISIX/其他服务部署一致
- 复用现有的 `wait_pods_ready`、`ensure_namespace_ready` 等工具函数
- 不引入额外脚本或工具依赖

**缺点**:
- deploy.sh 职责持续膨胀，文件增长
- 环境差异通过 if/else 分支处理，逻辑复杂度增加

### 选项 2: 独立 memory 专用脚本

**描述**: 创建 `k8s/memory-deploy.sh` 和 `k8s/memory-uninstall.sh`，独立管理 memory-service 生命周期

**优点**:
- 职责清晰，脚本独立
- 可独立执行 memory 相关操作

**缺点**:
- 设计文档明确要求 "dev / prod 使用同一脚本入口，不引入独立 memory 专用脚本"
- 运维需要记住两套脚本，认知成本增加
- 与其他服务（auth/user/ai）的集成模式不一致

### 选项 3: Helm Chart

**描述**: 将 koduck-memory 和 MinIO 封装为 Helm Chart

**优点**:
- 模板化程度高，环境差异通过 values 管理
- K8s 生态标准做法

**缺点**:
- 与现有 Kustomize 工作流不一致
- 引入额外工具依赖
- 对当前项目规模而言过度设计

---

## 决策结果

**选定的方案**: 选项 1 - 在现有 deploy.sh/uninstall.sh 中集成

**理由**:

1. **与设计文档一致**: 设计文档 13.3 节明确要求 "deploy.sh 负责 secret、MinIO、memory-service、bucket 初始化"
2. **统一入口**: dev/prod 共用同一脚本，与现有模式一致
3. **渐进式集成**: 利用现有工具函数（`wait_pods_ready`、`ensure_*`），改动量最小

**积极后果**:

- `./k8s/deploy.sh dev install` 一键完成全部部署
- 与 APISIX、auth、user、ai 等服务的部署体验一致

**消极后果**:

- deploy.sh 文件继续增长
- 环境差异分支增加

**缓解措施**:

- 将 memory 相关逻辑封装为独立函数（`ensure_koduck_memory_database_exists`、`wait_minio_ready`、`wait_bucket_init`）
- prod 环境通过 Kustomize overlay 差异化管理

---

## 实施细节

### 实施计划

- [x] ADR 评审和接受
- [ ] deploy.sh 增加 `ensure_koduck_memory_database_exists` 函数
- [ ] deploy.sh 增加 MinIO 就绪等待和 bucket init Job 等待
- [ ] deploy.sh 增加 koduck-memory Pod 就绪等待
- [ ] deploy.sh 增加 memory-service 访问信息展示
- [ ] uninstall.sh 增加 memory-service 清理说明
- [ ] prod overlay 增加 koduck-memory 和 MinIO 资源
- [ ] Docker build 验证
- [ ] dev 环境 rollout 验证

### 影响范围

- `k8s/deploy.sh`: 增加 memory-service 生命周期管理函数
- `k8s/uninstall.sh`: 增加清理说明（逻辑已覆盖）
- `k8s/overlays/prod/`: 新增 koduck-memory.yaml 和 minio.yaml
- `k8s/overlays/prod/kustomization.yaml`: 增加资源和 patch

### 兼容性影响

- **向后兼容**: 现有 APISIX 部署流程不受影响
- **环境变量**: koduck-memory 的 secret 已在 YAML manifests 中定义，通过 Kustomize namePrefix 自动适配
- **数据库**: 新增 `koduck_memory` 数据库创建步骤，与现有 `ensure_user_db_exists` 模式一致

---

## 相关文档

- [koduck-memory 设计文档](../design/koduck-memory-for-koduck-ai.md)
- [Task 8.2 实施清单](../implementation/koduck-memory-koduck-ai-tasks.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-12 | 初始版本 | @hailingu |
