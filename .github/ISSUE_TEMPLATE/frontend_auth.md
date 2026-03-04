---
name: Frontend Auth
about: 认证模块 - 登录/注册/权限管理
labels: ["frontend", "auth"]
---

## 概述

实现用户认证模块，包括登录、注册、JWT Token 管理、权限控制。

## 依赖

- 需完成后端 Auth API (已完成 ✅)

## 任务清单

### 1. 登录页面
- [ ] 登录表单 (用户名/密码)
- [ ] 表单验证 (required, minLength)
- [ ] 记住密码功能
- [ ] 登录状态持久化 (localStorage)
- [ ] 错误提示处理

### 2. 注册页面
- [ ] 注册表单 (用户名/密码/确认密码)
- [ ] 密码强度检测
- [ ] 表单验证
- [ ] 注册成功跳转

### 3. Token 管理
- [ ] JWT Token 存储 (httpOnly cookie / localStorage)
- [ ] Token 自动刷新机制
- [ ] 登录状态全局管理 (Zustand)
- [ ] 登出功能

### 4. 路由守卫
- [ ] ProtectedRoute 组件
- [ ] 未登录跳转登录页
- [ ] 权限检查 (RBAC)

### 5. 用户信息
- [ ] 获取用户信息 API 封装
- [ ] 用户头像/名称展示
- [ ] 个人中心入口

## API 接口

```typescript
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/info
POST /api/auth/refresh
```

## 验收标准

- [ ] 登录成功后跳转 Dashboard
- [ ] Token 过期自动刷新
- [ ] 未登录访问受保护页面自动跳转
- [ ] 权限不足显示 403 页面

## 关联

- 后端: #4 (Auth API)
- 父 Issue: #1
