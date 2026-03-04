---
name: Market Data Refactor (AKShare)
about: 重构市场数据模块 - 引入 Python Data Service
labels: ["enhancement", "data-service", "a-share"]
---

## 背景

当前 PR #6 规划的市场数据模块原方案计划直接通过 Python 获取 A 股数据，但面临以下问题：
- A 股数据源不稳定，部分 API 有访问限制
- 若直接在 Java 中处理，缺乏成熟的 A 股数据 SDK
- 需要同时支持美股、加密货币等多种市场，统一维护成本高

## 目标

引入独立的 **Python Data Service**，使用 [AKShare](https://www.akshare.xyz/) 作为 A 股数据源，通过 HTTP API 与 Java 后端通信，实现：
- 高内聚：数据获取逻辑独立成服务
- 易扩展：支持多实例部署
- 可维护：Python 生态处理金融数据更便捷

## 技术方案

### 架构设计

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│  Java API    │────▶│   Redis Cache   │
└─────────────┘     │  (Koduck)    │◀────│  (热点数据缓存)  │
                    └──────┬───────┘     └─────────────────┘
                           │
                           │ HTTP/JSON
                           ▼
                    ┌─────────────┐
                    │ Python Data │     ┌─────────────┐
                    │  Service    │────▶│   AKShare   │
                    │  (FastAPI)  │     │   (A股数据)  │
                    └─────────────┘     └─────────────┘
```

### 服务拆分

| 服务 | 技术栈 | 职责 |
|------|--------|------|
| `koduck-backend` | Java 23 + Spring Boot | API 网关、业务逻辑、缓存 |
| `koduck-data-service` | Python 3.11 + FastAPI | 数据获取、格式转换 |

### 接口约定

**Python Data Service** 提供以下 REST API：

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/a-share/search?keyword={kw}&limit=20` | A股代码搜索 |
| GET | `/api/v1/a-share/price/{symbol}` | 个股实时价格 |
| POST | `/api/v1/a-share/price/batch` | 批量获取价格 |
| GET | `/api/v1/a-share/hot?limit=20` | 热门股票 |

**返回格式统一包装：**
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

## 任务清单

### Phase 1: Python Data Service 基础
- [ ] 创建 `koduck-data-service/` 目录结构
- [ ] 搭建 FastAPI 项目框架
- [ ] 封装 AKShare 客户端 (`akshare_client.py`)
  - [ ] `search_symbols()` - 代码搜索
  - [ ] `get_realtime_price()` - 实时价格
  - [ ] `get_batch_prices()` - 批量价格
  - [ ] `get_hot_symbols()` - 热门股票
- [ ] 实现 A股路由 (`a_share.py`)
- [ ] 添加健康检查接口 `/health`
- [ ] 编写 `requirements.txt`

### Phase 2: 部署配置
- [ ] 编写 `Dockerfile`
- [ ] 编写 `docker-compose.yml`（含 Redis）
- [ ] 添加日志配置
- [ ] 添加基础监控指标

### Phase 3: Java 后端集成
- [ ] 新增 `AKShareDataProvider` 实现 `MarketDataProvider`
- [ ] 配置 HTTP Client (RestTemplate/WebClient)
- [ ] 实现服务发现/负载均衡（可选）
- [ ] 添加熔断降级逻辑（Resilience4j）

### Phase 4: 缓存优化
- [ ] Java 层集成 Redis 缓存
- [ ] 配置合理的缓存过期策略
- [ ] 热点数据预热机制

### Phase 5: 测试与文档
- [ ] Python 服务单元测试
- [ ] Java 端集成测试
- [ ] API 文档（OpenAPI/Swagger）
- [ ] 部署文档

## 目录结构

```
koduck-quant/
├── koduck-backend/              # Java 后端 (现有)
│   └── src/...
├── koduck-data-service/         # 新增: Python 数据服务
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 配置管理
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── a_share.py       # A股接口
│   │   │   ├── us_stock.py      # 美股接口 (预留)
│   │   │   └── crypto.py        # 加密货币 (预留)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── akshare_client.py    # AKShare 封装
│   │   │   └── cache_manager.py     # 本地缓存
│   │   └── models/
│   │       └── schemas.py       # Pydantic 模型
│   ├── tests/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
└── ...
```

## 技术选型

| 组件 | 选择 | 版本 |
|------|------|------|
| Web 框架 | FastAPI | ^0.104.0 |
| 数据获取 | AKShare | ^1.11.0 |
| HTTP 客户端 | httpx | ^0.25.0 |
| 缓存 | redis-py | ^5.0.0 |
| 配置 | pydantic-settings | ^2.0.0 |
| 部署 | Docker + Docker Compose | - |

## 环境变量

```bash
# Python Data Service
DATA_SERVICE_PORT=8000
DATA_SERVICE_HOST=0.0.0.0
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=INFO

# Java Backend
DATA_SERVICE_BASE_URL=http://localhost:8000/api/v1
DATA_SERVICE_TIMEOUT_MS=5000
```

## 验收标准

- [ ] Python Data Service 可独立启动并响应请求
- [ ] `/health` 接口返回正常状态
- [ ] A 股代码搜索响应时间 < 500ms（首次）
- [ ] A 股实时价格查询响应时间 < 200ms（有缓存时 < 50ms）
- [ ] Java 后端可通过配置切换数据源（AKShare / Mock / 其他）
- [ ] Docker Compose 可一键启动完整服务栈
- [ ] 单元测试覆盖率 > 70%

## 关联

- 替代/关闭: PR #6
- 归属 Epic: #1

## 参考

- [AKShare 文档](https://www.akshare.xyz/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
