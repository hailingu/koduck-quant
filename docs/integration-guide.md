# KODUCK Quant 前后端对接开发指南

> 本文档指导开发者如何搭建开发环境并完成前后端功能对接。

## 目录

- [环境准备](#环境准备)
- [服务启动](#服务启动)
- [端口配置](#端口配置)
- [API 对接列表](#api-对接列表)
- [数据格式规范](#数据格式规范)
- [常见问题](#常见问题)

---

## 环境准备

### 1. 技术栈要求

| 组件 | 版本 | 用途 |
|------|------|------|
| Java | 23+ | 后端开发 |
| Maven | 3.9+ | Java 构建工具 |
| Node.js | 20+ | 前端开发 |
| npm | 10+ | 前端包管理 |
| Python | 3.12+ | 数据服务 |
| PostgreSQL | 15+ | 主数据库 |
| Redis | 7+ | 缓存/会话 |

### 2. 数据库初始化

```bash
# 启动 PostgreSQL
pg_ctl start -D /usr/local/var/postgresql@15

# 创建数据库
createdb koduck_quant

# 配置连接 (application-dev.yml)
# 首次启动时 JPA 会自动创建表结构
```

### 3. Redis 启动

```bash
# 使用 Homebrew 安装的 Redis
brew services start redis

# 或使用 Docker
docker run -d -p 6379:6379 redis:7-alpine

# 验证连接
redis-cli ping
# 输出: PONG
```

---

## 服务启动

### 启动顺序

必须按以下顺序启动服务：

1. PostgreSQL + Redis
2. Python Data Service (port 8000)
3. Java Backend (port 8080)
4. React Frontend (port 3000)

### 1. Python Data Service

```bash
cd koduck-data-service

# 创建虚拟环境（首次）
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 安装依赖（首次）
pip install -r requirements.txt

# 启动服务
python -m app.main
# 或
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**验证**: http://localhost:8000/health

### 2. Java Backend

```bash
cd koduck-backend

# 使用 Maven Wrapper
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# 或使用本地 Maven
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 打包运行（生产环境）
./mvnw clean package -DskipTests
java -jar target/koduck-backend-*.jar --spring.profiles.active=dev
```

**验证**: http://localhost:8080/api/v1/health

### 3. React Frontend

```bash
cd koduck-frontend

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev

# 服务将启动在 http://localhost:3000
```

**访问**: http://localhost:3000

---

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| React Frontend | 3000 | 开发服务器 |
| Java Backend | 8080 | Spring Boot |
| Python Data Service | 8000 | FastAPI |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存 |

### 代理配置

前端开发服务器使用 Vite 代理将 `/api` 请求转发到后端：

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

**请求流程**:
```
浏览器: http://localhost:3000/api/v1/xxx
    ↓
Vite 代理: 匹配 /api，转发到 http://localhost:8080/api/v1/xxx
    ↓
后端接收: /api/v1/xxx
```

---

## API 对接列表

### 认证模块

| 功能 | 后端端点 | 前端调用 | 状态 |
|------|----------|----------|------|
| 用户登录 | `POST /api/v1/auth/login` | Login Page | ✅ |
| 用户注册 | `POST /api/v1/auth/register` | Register Page | ✅ |
| 刷新 Token | `POST /api/v1/auth/refresh` | request.ts 拦截器 | ✅ |
| 用户登出 | `POST /api/v1/auth/logout` | Settings Page | ✅ |
| 安全配置 | `GET /api/v1/auth/security-config` | - | ✅ |

### K线数据模块

| 功能 | 后端端点 | 前端调用 | 状态 |
|------|----------|----------|------|
| 获取 K线 | `GET /api/v1/kline` | klineApi.getKline | ✅ |
| 实时价格 | `GET /api/v1/kline/price` | klineApi.getLatestPrice | ✅ |
| 股票搜索 | `GET /api/v1/a-share/search` | klineApi.searchStocks | ✅ |

**K线请求参数**:
```typescript
{
  market: 'AShare',      // 市场: AShare/US/HK/Crypto
  symbol: '000001',      // 股票代码
  timeframe: '1D',       // 周期: 1m/5m/15m/30m/60m/1D/1W/1M
  limit: 300,            // 返回条数
  startTime?: string,    // 开始时间 (ISO)
  endTime?: string       // 结束时间 (ISO)
}
```

### 自选股模块

| 功能 | 后端端点 | 前端调用 | 状态 |
|------|----------|----------|------|
| 获取列表 | `GET /api/v1/watchlist` | watchlistApi.getWatchlist | ✅ |
| 添加 | `POST /api/v1/watchlist` | watchlistApi.addToWatchlist | ✅ |
| 删除 | `DELETE /api/v1/watchlist/{id}` | watchlistApi.removeFromWatchlist | ✅ |
| 更新排序 | `PUT /api/v1/watchlist/sort` | watchlistApi.sortWatchlist | ✅ |
| 更新备注 | `PUT /api/v1/watchlist/{id}/notes` | watchlistApi.updateNotes | ✅ |

### 用户中心模块

| 功能 | 后端端点 | 前端调用 | 状态 |
|------|----------|----------|------|
| 获取当前用户 | `GET /api/v1/users/me` | userApi.getCurrentUser | ✅ |
| 更新资料 | `PUT /api/v1/users/me` | userApi.updateProfile | ✅ |
| 修改密码 | `PUT /api/v1/users/me/password` | userApi.changePassword | ✅ |
| 上传头像 | TODO | userApi.uploadAvatar | ⏳ |

### 投资组合模块 (待实现)

| 功能 | 后端端点 | 前端调用 | 状态 |
|------|----------|----------|------|
| 获取持仓 | `GET /api/v1/portfolio` | portfolioApi.getPortfolio | ⏳ |
| 添加持仓 | `POST /api/v1/portfolio` | portfolioApi.addPosition | ⏳ |
| 更新持仓 | `PUT /api/v1/portfolio/{id}` | portfolioApi.updatePosition | ⏳ |
| 删除持仓 | `DELETE /api/v1/portfolio/{id}` | portfolioApi.removePosition | ⏳ |

### 技术指标模块 (待实现)

| 功能 | 后端端点 | 前端调用 | 状态 |
|------|----------|----------|------|
| 获取指标 | `GET /api/v1/indicators/{symbol}` | - | 📋 |
| 支持指标 | MA, MACD, RSI, KDJ, BOLL | - | 📋 |

---

## 数据格式规范

### 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "timestamp": 1740723600000,
  "traceId": "abc123"
}
```

### 字段命名转换

| 后端 (snake_case) | 前端 (camelCase) |
|-------------------|------------------|
| user_name | userName |
| avatar_url | avatarUrl |
| created_at | createdAt |
| sort_order | sortOrder |

**自动转换**: `request.ts` 中使用 `keysToCamelCase()` 自动转换响应数据。

### 分页格式

```json
{
  "content": [],
  "page": 1,
  "size": 20,
  "totalElements": 100,
  "totalPages": 5
}
```

---

## 常见问题

### 1. API 请求路径重复

**问题**: 请求路径变为 `/api/api/v1/xxx`

**原因**: 
- `vite.config.ts` 中配置了 `/api` 代理
- `.env.development` 中 `VITE_API_BASE_URL=/api`

**解决**:
```bash
# .env.development
VITE_API_BASE_URL=    # 留空，不要设置 /api
```

### 2. CORS 跨域错误

**问题**: `Access-Control-Allow-Origin` 错误

**解决**: 
- 开发环境使用 Vite 代理，无跨域问题
- 生产环境后端配置 CORS：
```java
// 已在后端配置
@CrossOrigin(origins = "*")  // 或指定域名
```

### 3. Token 失效处理

**问题**: 401 Unauthorized 错误

**处理逻辑**: `request.ts` 响应拦截器自动处理
```typescript
if (status === 401) {
  localStorage.removeItem('token')
  localStorage.removeItem('auth-storage')
  window.location.href = '/login'
}
```

### 4. 字段名不匹配

**问题**: 后端返回 `avatar_url`，前端使用 `avatarUrl`

**解决**: 统一使用 `keysToCamelCase()` 转换
```typescript
const camelData = keysToCamelCase(apiResponse.data)
```

### 5. 后端服务未启动

**症状**: 
- 页面显示 "加载失败"
- Network 显示 500/502 错误

**检查**:
```bash
# 检查各服务状态
curl http://localhost:8080/api/v1/health  # Java Backend
curl http://localhost:8000/health         # Python Service
redis-cli ping                            # Redis
```

### 6. 数据库连接失败

**症状**: Java 后端启动失败，提示数据库连接错误

**解决**:
```bash
# 检查 PostgreSQL 是否运行
pg_ctl status -D /usr/local/var/postgresql@15

# 检查数据库是否存在
psql -l | grep koduck_quant

# 检查配置文件
# koduck-backend/src/main/resources/application-dev.yml
```

---

## 开发工作流

### 添加新 API 步骤

1. **后端**: 在 Controller 中添加端点
   ```java
   @GetMapping("/new-endpoint")
   public ApiResponse<NewData> getNewData() { }
   ```

2. **前端**: 在 `src/api/` 添加 API 函数
   ```typescript
   export const newApi = {
     getNewData: () => request.get<NewData>('/api/v1/new-endpoint')
   }
   ```

3. **类型**: 在接口中定义请求/响应类型
   ```typescript
   export interface NewData { }
   ```

4. **页面**: 在组件中调用 API
   ```typescript
   const data = await newApi.getNewData()
   ```

---

## 相关文档

- [项目 README](../README.md)
- [CONTRIBUTING](../CONTRIBUTING.md)
- [AGENTS](../AGENTS.md)

---

*最后更新: 2025-03-01*
