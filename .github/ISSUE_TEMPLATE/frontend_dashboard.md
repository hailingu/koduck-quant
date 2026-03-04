---
name: Frontend Dashboard
about: 仪表盘页面 - 数据概览/快捷入口
labels: ["frontend", "dashboard"]
---

## 概述

实现 Dashboard 首页，展示用户数据概览、自选股行情、快捷操作入口。

## 功能模块

### 1. 数据卡片 (Data Cards)
- [ ] 总资产卡片
- [ ] 今日盈亏卡片
- [ ] 持仓数量卡片
- [ ] 自选股数量卡片

### 2. 自选股行情 (Watchlist Preview)
- [ ] 显示前 5 只自选股
- [ ] 股票名称/代码
- [ ] 当前价格
- [ ] 涨跌幅 (红/绿颜色)
- [ ] 点击进入详情

### 3. 快捷入口 (Quick Actions)
- [ ] 添加自选股按钮
- [ ] 市场行情入口
- [ ] K线分析入口
- [ ] 最近浏览

### 4. 图表展示
- [ ] 账户收益趋势图 (近 7 天)
- [ ] 资产分布饼图

## 数据结构

```typescript
interface DashboardData {
  summary: {
    totalAssets: number;
    dailyPnL: number;
    positions: number;
    watchlistCount: number;
  };
  watchlist: Array<{
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
  }>;
  recentViews: Array<{
    symbol: string;
    name: string;
    viewTime: string;
  }>;
}
```

## API 接口

```typescript
GET /api/v1/dashboard/summary
GET /api/v1/watchlist?limit=5
```

## UI 设计

- 网格布局: 4 列卡片 + 2 列图表
- 卡片: rounded-xl, shadow-md
- 涨跌幅: 红(+)/绿(-) 颜色

## 验收标准

- [ ] 数据实时加载
- [ ] 卡片响应式布局
- [ ] 点击跳转正确
- [ ] 空状态处理

## 关联

依赖: 
- #21 (项目初始化)
- #22 (布局框架)
- #8 (后端 Watchlist API)
