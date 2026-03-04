---
name: Frontend Layout
about: 布局框架 - 侧边栏/顶部导航/主题切换
labels: ["frontend", "layout"]
---

## 概述

实现统一的布局框架，包含侧边栏导航、顶部工具栏、主题切换等功能。

## 任务清单

### 1. 布局组件
- [ ] MainLayout 组件
- [ ] 侧边栏 (Sidebar)
  - Logo 区域
  - 导航菜单
  - 折叠/展开功能
- [ ] 顶部栏 (Header)
  - 面包屑导航
  - 用户菜单 (头像/下拉)
  - 通知图标
  - 全屏切换

### 2. 导航系统
- [ ] 路由配置 (React Router)
- [ ] 菜单配置文件
- [ ] 当前菜单高亮
- [ ] 子菜单支持

### 3. 菜单项
```javascript
const menuItems = [
  { key: '/dashboard', icon: 'Dashboard', label: '仪表盘' },
  { key: '/market', icon: 'LineChart', label: '市场行情' },
  { key: '/watchlist', icon: 'Star', label: '自选股' },
  { key: '/kline', icon: 'Candlestick', label: 'K线分析' },
  { key: '/portfolio', icon: 'PieChart', label: '投资组合' },
  { key: '/settings', icon: 'Settings', label: '系统设置' },
];
```

### 4. 主题切换
- [ ] Light/Dark 模式
- [ ] Tailwind darkMode 配置
- [ ] 主题状态持久化

### 5. 响应式适配
- [ ] 移动端侧边栏抽屉
- [ ] 断点: sm(640), md(768), lg(1024), xl(1280)

## 组件设计

```typescript
// components/layout/MainLayout.tsx
interface MainLayoutProps {
  children: React.ReactNode;
}

// components/layout/Sidebar.tsx
interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}
```

## 验收标准

- [ ] 布局在所有页面一致
- [ ] 侧边栏可折叠
- [ ] 主题切换正常工作
- [ ] 移动端适配良好

## 关联

依赖: #21 (项目初始化)
