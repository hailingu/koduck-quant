# Koduck Frontend

量化交易平台前端 - React + Vite + Tailwind CSS

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 3.4
- **路由**: React Router v6
- **状态管理**: Zustand
- **HTTP 客户端**: Axios

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 预览
npm run preview
```

## 目录结构

```
src/
├── api/           # API 接口封装
├── components/    # 公共组件
├── hooks/         # 自定义 Hooks
├── layouts/       # 布局组件
├── pages/         # 页面组件
├── router/        # 路由配置
├── stores/        # 状态管理
├── styles/        # 全局样式
├── types/         # TypeScript 类型
└── utils/         # 工具函数
```

## 环境变量

- `.env.development` - 开发环境
- `.env.production` - 生产环境

## 路径别名

- `@/*` - src 目录
- `@components/*` - 组件目录
- `@pages/*` - 页面目录
- `@api/*` - API 目录
- `@stores/*` - 状态管理目录
