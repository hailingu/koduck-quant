---
name: Frontend Portfolio
about: 投资组合页面 - 持仓管理/盈亏分析
labels: ["frontend", "portfolio"]
---

## 概述

实现投资组合管理页面，展示持仓列表、盈亏分析、资产配置。

## 任务清单

### 1. 持仓列表
- [ ] 表格展示持仓
- [ ] 列: 股票/持仓数量/成本价/当前价/市值/盈亏/盈亏率
- [ ] 盈亏红绿颜色
- [ ] 汇总行 (总成本/总市值/总盈亏)

### 2. 盈亏分析
- [ ] 今日盈亏卡片
- [ ] 累计盈亏卡片
- [ ] 收益率曲线图
- [ ] 盈亏分布图

### 3. 资产配置
- [ ] 资产分布饼图
- [ ] 行业分布统计
- [ ] 仓位占比

### 4. 交易记录
- [ ] 买卖记录列表
- [ ] 筛选 (时间/股票/类型)
- [ ] 添加交易记录

### 5. 操作功能
- [ ] 添加持仓
- [ ] 编辑持仓
- [ ] 删除持仓
- [ ] 导入交易记录 (CSV)

## 数据结构

```typescript
interface PortfolioItem {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioSummary {
  totalCost: number;
  totalMarketValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
}
```

## 图表需求

- 收益曲线: Line Chart (ECharts)
- 资产分布: Pie Chart
- 行业分布: Bar Chart

## 验收标准

- [ ] 持仓数据正确显示
- [ ] 盈亏计算准确
- [ ] 图表正常渲染
- [ ] 操作功能正常

## 关联

依赖:
- #21 (项目初始化)
- 后端 Portfolio API (待开发)
