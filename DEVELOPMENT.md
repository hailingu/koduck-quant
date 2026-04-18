# Koduck Quant 开发指南

> 当前仓库统一使用 Kubernetes 作为部署与联调入口；Docker Compose 相关流程已移除。

## 环境准备

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Docker | 最新 | 用于构建本地 `*:dev` 镜像 |
| Kubernetes | 可连接集群 | `docker-desktop` / 本地集群均可 |
| kubectl | 最新 | K8s 运维命令 |
| Java | 23+ | Java 服务开发 |
| Maven | 3.9+ | Java 构建 |
| Node.js | 20+ | 前端开发 |
| Python | 3.12+ | Python 服务/脚本 |

## 快速开始

### 1. 配置 K8s 环境变量

```bash
cp k8s/.env.template k8s/.env.dev
```

按需填写 `k8s/.env.dev` 中的密钥与环境值。

### 2. 构建需要更新的 dev 镜像

```bash
# 示例：构建 auth 服务
docker build -t koduck-auth:dev ./koduck-auth
```

### 3. 部署 dev 环境

```bash
./k8s/deploy.sh dev install
```

### 4. 查看运行状态

```bash
./k8s/deploy.sh dev status
kubectl get pods -n koduck-dev
```

### 5. 端口转发

```bash
./k8s/deploy.sh dev port-forward
```

## 单服务迭代

适合只修改一个服务时使用。

```bash
# 1) 构建本地镜像
docker build -t koduck-auth:dev ./koduck-auth

# 2) 重启对应 deployment
kubectl rollout restart deployment/dev-koduck-auth -n koduck-dev

# 3) 等待完成
kubectl rollout status deployment/dev-koduck-auth -n koduck-dev --timeout=180s
```

## 常用命令

```bash
# Makefile 入口
make k8s-dev-install
make k8s-dev-status
make build-auth-dev
make rollout-auth-dev

# 直接使用脚本
./k8s/deploy.sh dev install
./k8s/deploy.sh dev status
./k8s/uninstall.sh dev
```

## 代码质量

```bash
make quality
make quality-pmd
make quality-spotbugs
make quality-test
```

## 说明

- 根目录不再维护 Docker Compose 启动方式。
- 若文档中仍出现旧的 Compose 示例，应视为历史内容，当前以 `k8s/` 为准。
