# Koduck Quant Docker 部署指南

本文档介绍如何使用 Docker Compose 一键启动完整的 Koduck Quant 系统。

## 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Nginx        │────▶│  Java Backend   │
│   (React)       │     │   (Port 3000)   │     │  (Port 8080)    │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                              ▼                         ▼                         ▼
                    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
                    │   PostgreSQL    │      │     Redis       │      │ Python Data     │
                    │   (Port 5432)   │      │   (Port 6379)   │      │   (Port 8000)   │
                    └─────────────────┘      └─────────────────┘      └─────────────────┘
```

## 快速开始

### 1. 环境要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改敏感配置（如 JWT_SECRET）
vim .env
```

### 3. 启动系统

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
```

### 4. 访问服务

- **前端界面**: http://localhost:3000
- **后端 API**: http://localhost:8080/api/v1
- **健康检查**: http://localhost:8080/actuator/health

### 5. 停止系统

```bash
# 停止服务（保留数据）
docker-compose down

# 停止服务并删除数据卷（⚠️ 数据将丢失）
docker-compose down -v
```

## 常用命令

### 查看服务状态

```bash
docker-compose ps
docker-compose top
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs

# 查看最后 100 行
docker-compose logs --tail=100

# 实时跟踪日志
docker-compose logs -f

# 查看特定服务
docker-compose logs -f backend
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend

# 重建并重启（代码更新后）
docker-compose up -d --build backend
```

### 进入容器

```bash
# 进入后端容器
docker-compose exec backend sh

# 进入数据库
docker-compose exec postgresql psql -U koduck -d koduck_dev

# 进入 Redis
docker-compose exec redis redis-cli
```

### 数据管理

```bash
# 备份数据库
docker-compose exec postgresql pg_dump -U koduck koduck_dev > backup.sql

# 恢复数据库
docker-compose exec -T postgresql psql -U koduck koduck_dev < backup.sql
```

## 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `POSTGRES_DB` | koduck_dev | 数据库名 |
| `POSTGRES_USER` | koduck | 数据库用户 |
| `POSTGRES_PASSWORD` | koduck | 数据库密码 |
| `JWT_SECRET` | - | JWT 签名密钥（生产环境必须修改） |
| `SPRING_PROFILES_ACTIVE` | dev | Spring Boot 环境配置 |

## 生产环境部署

### 1. 配置环境变量

```bash
# 使用生产环境配置
cp .env.example .env

# 编辑 .env，设置强密码和密钥
vim .env
```

### 2. 使用生产配置启动

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. 生产环境注意事项

- 务必修改 `JWT_SECRET` 为强随机字符串
- 使用复杂的数据库密码
- 配置防火墙只开放必要的端口
- 定期备份数据卷
- 启用日志轮转

## 故障排查

### 服务启动失败

```bash
# 查看详细日志
docker-compose logs --no-color > logs.txt

# 检查资源使用
docker stats
```

### 数据库连接失败

```bash
# 检查数据库健康状态
docker-compose exec postgresql pg_isready -U koduck

# 查看数据库日志
docker-compose logs postgresql
```

### 端口冲突

```bash
# 查看端口占用
lsof -i :5432
lsof -i :6379
lsof -i :8080
lsof -i :3000
lsof -i :8000
```

修改 `docker-compose.yml` 中的端口映射，或停止占用端口的服务。

### 清理重建

```bash
# 完全清理（⚠️ 所有数据将丢失）
docker-compose down -v
docker-compose down --rmi all
docker system prune -a

# 重新构建
docker-compose up -d --build
```

## 开发模式

### 本地开发（不使用 Docker）

```bash
# 1. 只启动数据库和缓存
docker-compose up -d postgresql redis

# 2. 本地启动后端（IntelliJ 或 ./mvnw spring-boot:run）

# 3. 本地启动前端（npm run dev）
```

### 热重载开发

修改代码后，需要重建对应服务：

```bash
# 后端代码更新
docker-compose up -d --build backend

# 前端代码更新
docker-compose up -d --build frontend
```

## 性能优化

### 调整 JVM 参数

编辑 `koduck-backend/Dockerfile`：

```dockerfile
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC"
```

### 调整 Nginx 配置

编辑 `koduck-frontend/nginx.conf`，调整 worker 进程和连接数。

## 安全建议

1. **修改默认密码**: 生产环境务必修改所有默认密码
2. **使用 HTTPS**: 配置 SSL 证书
3. **限制端口访问**: 使用防火墙限制数据库端口仅内部访问
4. **定期更新**: 定期更新基础镜像
5. **日志审计**: 启用访问日志并定期审查

## 参考文档

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Spring Boot Docker](https://spring.io/guides/topicals/spring-boot-docker/)
