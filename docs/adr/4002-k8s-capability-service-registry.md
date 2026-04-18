# ADR-4002: 基于 Kubernetes CRD 的 Capability Service Registry

- Status: Accepted
- Date: 2026-04-17

## Context

随着 `koduck-ai`、`koduck-memory` 与 `koduck-knowledge` 逐步拆分为独立子服务，系统需要一套真正的服务发现模型来回答以下问题：

1. 当前集群里有哪些可被 AI 编排的能力服务。
2. 某个服务属于 `memory`、`knowledge`、`tool` 还是其他种类。
3. `koduck-ai` 应该通过什么 southbound target 调用这些服务。
4. 新服务上线或下线后，`koduck-ai` 如何动态感知。

当前仓库已有两类基础设施，但都不足以直接承担这件事：

- **Kubernetes Service / EndpointSlice** 解决的是网络寻址，不表达业务语义。
- **APISIX etcd** 当前只用于保存网关配置（route / upstream / plugin metadata），不适合作为业务语义注册中心。

同时，`koduck-ai` 已经有既有的能力协商机制：

- 对下游服务调用 `GetCapabilities`
- 启动时拉取并校验版本
- 运行时按 TTL 刷新

因此，本 ADR 的目标不是替换能力协商，而是补上“候选服务目录”的来源。

## Decision

### 1. 使用 Kubernetes CRD 作为 registry control plane

新增 namespaced CRD：`CapabilityService.platform.koduck.io/v1alpha1`。

该 CRD 负责描述：

- 服务种类（`memory` / `knowledge` / `tool` / `llm` / `ai` / `gateway`）
- 是否对 `koduck-ai` 暴露
- 调用入口（endpoint target / protocol）
- 能力探测方式（capability probe）
- 静态 feature/version hints

Kubernetes API 是 registry 的 source of truth。

### 2. APISIX 继续只承担 gateway / data plane 职责

APISIX 保持以下职责：

- `Frontend -> APISIX -> koduck-ai` 的 northbound 流量治理
- `koduck-ai -> APISIX -> memory/tool/...` 的 southbound 治理
- tracing、限流、认证头透传、超时与重试预算基线

APISIX etcd 不是业务服务注册表，不承担“谁是 tool / memory / knowledge”的判定职责。

### 3. `koduck-ai` 通过 Kubernetes API 拉取 registry

`koduck-ai` 增加 Kubernetes-backed registry client：

- 周期性拉取 namespace 内的 `CapabilityService`
- 将发现结果缓存到本地内存
- 对 `memory` / `tool` 等 southbound gRPC 目标优先使用 registry 中声明的 endpoint target
- 若 registry 不可用，则回退到现有静态配置

### 4. 能力协商仍由服务自身负责

registry 只负责“候选服务目录”。

服务支持的真实能力、契约版本和限制信息，仍然优先通过服务自身的 capability surface 提供：

- `koduck-memory` 继续使用 `GetCapabilities`
- `koduck-knowledge` 增加最小内部 capability 端点
- 后续 `tool-service` / 其他 southbound 服务也应提供自己的 capability surface

## Consequences

### 正向影响

1. `koduck-ai` 不再只依赖静态候选列表。
2. 服务语义从纯网络寻址中解耦出来，便于后续继续拆服务。
3. registry source of truth 放在 Kubernetes API，更符合集群控制面的职责边界。
4. APISIX 与业务注册表职责分离，避免把网关配置反向当作业务目录。

### 代价与风险

1. 新增了一套 CRD 与 RBAC，需要运维跟进。
2. 当前实现是“registry 拉取 + 本地缓存”，而不是独立 controller 驱动的完整状态机。
3. `koduck-knowledge` 当前只有最小 capability 元数据端点，真正 southbound tool contract 仍需后续补齐。

## Follow-ups

1. 为 `CapabilityService` 增加 controller/status，同步 Ready / EndpointSlice 状态。
2. 增加 `apisix-sync-controller`，将 registry 映射为 APISIX upstream/route 的派生状态。
3. 给 `koduck-knowledge` 增加正式 southbound contract，使其能被 `koduck-ai` 作为 first-class tool 使用。
