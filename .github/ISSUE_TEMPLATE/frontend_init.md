---
name: Frontend Init
about: 前端项目初始化 - React + Vite + Tailwind CSS
labels: ["frontend", "init"]
---

## 概述

初始化前端项目，搭建 React + Vite + Tailwind CSS 技术栈。

## 技术栈

- **框架**: React 18+
- **构建工具**: Vite 5+
- **样式**: Tailwind CSS 3.4+
- **路由**: React Router v6
- **状态管理**: Zustand / React Query
- **HTTP 客户端**: Axios
- **图表**: ECharts / TradingView Lightweight Charts

## 任务清单

### 1. 项目初始化
- [ ] 使用 Vite 创建 React + TypeScript 项目
- [ ] 配置 Tailwind CSS
- [ ] 配置 ESLint + Prettier
- [ ] 配置路径别名 (@/components, @/pages, etc.)

### 2. 基础目录结构
```
koduck-frontend/
├── public/
├── src/
│   ├── api/           # API 接口
│   ├── assets/        # 静态资源
│   ├── components/    # 公共组件
│   ├── hooks/         # 自定义 Hooks
│   ├── layouts/       # 布局组件
│   ├── pages/         # 页面组件
│   ├── router/        # 路由配置
│   ├── stores/        # 状态管理
│   ├── styles/        # 全局样式
│   ├── types/         # TypeScript 类型
│   └── utils/         # 工具函数
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### 3. 基础配置
- [ ] 配置环境变量 (.env.development, .env.production)
- [ ] 配置 API 请求封装 (axios instance)
- [ ] 配置路由守卫
- [ ] 配置全局样式 (variables, utilities)

### 4. 依赖安装
```bash
# 核心依赖
npm install react react-dom react-router-dom
npm install axios zustand @tanstack/react-query
npm install echarts react-chartjs-2

# 开发依赖
npm install -D vite @vitejs/plugin-react
npm install -D tailwindcss postcss autoprefixer
npm install -D typescript @types/react @types/react-dom
npm install -D eslint prettier eslint-plugin-react
```

## 验收标准

- [ ] `npm run dev` 正常启动
- [ ] `npm run build` 构建成功
- [ ] Tailwind CSS 样式生效
- [ ] TypeScript 类型检查通过

## 关联

归属 Epic: #1 (后端 API 已就绪)
