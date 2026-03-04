---
name: Frontend User
about: 用户中心 - 个人设置/安全设置
labels: ["frontend", "user"]
---

## 概述

实现用户中心页面，包括个人资料管理、密码修改、安全设置。

## 任务清单

### 1. 个人资料
- [ ] 头像上传/修改
- [ ] 昵称修改
- [ ] 邮箱绑定
- [ ] 手机绑定
- [ ] 个人简介

### 2. 安全设置
- [ ] 修改密码
- [ ] 两步验证 (2FA)
- [ ] 登录历史
- [ ] 设备管理

### 3. 偏好设置
- [ ] 主题选择 (Light/Dark)
- [ ] 语言切换
- [ ] 通知设置
- [ ] 默认时间周期

### 4. 账号管理
- [ ] 账号注销
- [ ] 数据导出

## 页面结构

```
/user/profile       # 个人资料
/user/security      # 安全设置
/user/preferences   # 偏好设置
/user/account       # 账号管理
```

## API 接口

```typescript
GET    /api/v1/user/profile
PUT    /api/v1/user/profile
POST   /api/v1/user/avatar
PUT    /api/v1/user/password
GET    /api/v1/user/login-history
```

## 验收标准

- [ ] 资料修改成功
- [ ] 头像上传正常
- [ ] 密码修改验证
- [ ] 设置持久化

## 关联

依赖:
- #21 (项目初始化)
- 后端 User API (部分已完成)
