# 模块边界与依赖规范

## 概述

本文档定义 koduck-backend 的模块边界、分层架构与依赖规则。

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Controller Layer (API)                                     │
│  - REST API 端点定义                                         │
│  - 请求参数校验 (@Valid)                                     │
│  - 响应封装                                                  │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (Business Logic)                             │
│  - 业务逻辑实现                                              │
│  - 事务管理 (@Transactional)                                 │
│  - 跨领域协调                                                │
├─────────────────────────────────────────────────────────────┤
│  Repository Layer (Data Access)                             │
│  - 数据库访问                                                │
│  - JPA/Hibernate 操作                                        │
├─────────────────────────────────────────────────────────────┤
│  Entity Layer (Domain Model)                                │
│  - JPA 实体定义                                              │
│  - 数据库映射                                                │
└─────────────────────────────────────────────────────────────┘
```

## 依赖规则

### ✅ 允许的依赖方向

```
Controller → Service → Repository → Entity
    ↓           ↓           ↓
   DTO        DTO/Entity   Entity
```

- **Controller** 可以依赖：Service, DTO
- **Service** 可以依赖：Repository, Entity, DTO, 其他 Service
- **Repository** 可以依赖：Entity
- **Entity** 只能依赖：自身
- **DTO** 可以依赖：其他 DTO, Entity（仅转换时）

### ❌ 禁止的依赖

| 违规类型 | 说明 | 示例 |
|---------|------|------|
| Repository → Service | 数据层不应依赖业务层 | Repository 注入 Service |
| Service → Controller | 业务层不应依赖 API 层 | Service 注入 Controller |
| Entity → DTO | 实体不应感知传输对象 | Entity 引用 DTO |
| Entity → Service | 实体不应依赖业务逻辑 | Entity 调用 Service |

## 模块统计

### 当前规模（Phase 2 基线）

| 模块 | 文件数 | 职责 |
|------|--------|------|
| controller | 22 | API 端点 |
| service | 84 | 业务逻辑 |
| repository | 37 | 数据访问 |
| entity | 36 | 领域模型 |
| dto | 100 | 数据传输对象 |
| mapper | 9 | 对象映射 |

### 模块分组

```
com.koduck
├── client/          # 外部 HTTP 客户端
├── common/          # 共享常量
├── config/          # Spring 配置
├── controller/      # REST API
│   ├── auth/        # 认证相关
│   ├── market/      # 行情数据
│   ├── portfolio/   # 投资组合
│   └── ...
├── dto/             # 数据传输对象
├── entity/          # JPA 实体
├── exception/       # 异常定义
├── mapper/          # MapStruct 映射
├── market/          # 行情模块（独立域）
├── messaging/       # 消息队列
├── repository/      # 数据访问层
├── security/        # 安全配置
├── service/         # 业务逻辑层
│   ├── impl/        # 实现类
│   └── market/      # 行情服务
└── util/            # 工具类
```

## 循环依赖检测

### 当前状态

✅ 未发现 Service 层循环依赖

### 检测方法

```bash
./scripts/check-arch-violations.sh
```

### 预防措施

1. **接口隔离**：通过接口而非实现类依赖
2. **事件驱动**：使用 Spring Event 解耦
3. **依赖注入**：构造函数注入，避免字段注入

## CI 检查

### GitHub Actions 集成

```yaml
name: Architecture Guard
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check architecture violations
        run: |
          cd koduck-backend
          ./scripts/check-arch-violations.sh
```

## 验收标准

- [x] 无 Repository → Service 违规
- [x] 无 Service → Controller 违规
- [x] 无 Entity → DTO 违规
- [x] 无 Mapper → Service 违规
- [x] 无 Service 层循环依赖
- [x] 架构检查脚本可运行
- [x] 文档完成
