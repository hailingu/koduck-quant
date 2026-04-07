# Koduck Kubernetes 部署

使用 Kustomize 管理多环境配置，包含 APISIX Gateway 和 Koduck Frontend。

## 目录结构

```
k8s/
├── base/
│   ├── namespace.yaml          # 命名空间
│   ├── frontend.yaml           # Koduck Frontend 基础配置
│   └── apisix.yaml             # APISIX + etcd 基础配置
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml  # 开发环境配置
│   │   ├── frontend.yaml       # 开发环境 Frontend 覆盖
│   │   └── apisix.yaml         # 开发环境 APISIX 覆盖
│   └── prod/
│       ├── kustomization.yaml  # 生产环境配置
│       ├── frontend.yaml       # 生产环境 Frontend 覆盖
│       └── apisix.yaml         # 生产环境 APISIX 覆盖
├── deploy.sh                   # 部署脚本
├── uninstall.sh                # 卸载脚本
└── README.md
```

## 使用方法

### 部署

```bash
# 开发环境（低资源）
./deploy.sh dev install

# 生产环境（高资源 + 多副本）
./deploy.sh prod install
```

### 查看状态

```bash
./deploy.sh dev status
./deploy.sh prod status
```

### 端口转发

```bash
./deploy.sh dev port-forward
# 访问 http://localhost:9080
```

### 查看日志

```bash
./deploy.sh dev logs
```

### 卸载

```bash
# 卸载开发环境
./uninstall.sh dev

# 卸载生产环境
./uninstall.sh prod

# 卸载所有环境
./uninstall.sh all
```

## 环境差异

| 配置项 | 开发环境 (dev) | 生产环境 (prod) |
|--------|---------------|----------------|
| Gateway 副本 | 1 | 2 |
| Gateway 内存 | 64Mi/128Mi | 256Mi/512Mi |
| etcd 内存 | 64Mi/128Mi | 256Mi/512Mi |
| Frontend 副本 | 1 | 2 |
| Frontend 内存 | 32Mi/64Mi | 64Mi/128Mi |
| PVC 存储 | 1Gi | 10Gi |
| 命名空间 | koduck-dev | koduck-prod |

## 手动使用 Kustomize

```bash
# 预览配置
kustomize build overlays/dev

# 应用配置
kustomize build overlays/dev | kubectl apply -f -

# 或使用 kubectl
kubectl apply -k overlays/dev
```

## 访问

```bash
# NodePort
kubectl get svc -n koduck-dev

# APISIX Gateway Port-Forward
kubectl port-forward svc/dev-apisix-gateway 9080:9080 -n koduck-dev

# Frontend Port-Forward
kubectl port-forward svc/dev-koduck-frontend 8080:80 -n koduck-dev

# Admin API (prod)
kubectl port-forward svc/prod-apisix-gateway 9180:9180 -n koduck-prod
curl http://localhost:9180/apisix/admin/routes \
  -H 'X-API-KEY: edd1c9f034335f136f87ad84b625c8f1'
```
