---
name: Frontend Kline
about: K线图表页面 - 股票行情/技术分析
labels: ["frontend", "kline", "chart"]
---

## 概述

实现 K线图表页面，支持多周期切换、技术指标、股票搜索等功能。

## 技术选型

- **图表库**: TradingView Lightweight Charts 或 ECharts
- **推荐**: TradingView (专业 K线体验)

## 任务清单

### 1. K线图表组件
- [ ] 集成 Lightweight Charts
- [ ] 蜡烛图 (Candlestick)
- [ ] 成交量图 (Volume)
- [ ] 时间轴缩放/拖拽
- [ ] 十字光标 (Crosshair)
- [ ] 价格提示框

### 2. 周期切换
- [ ] 时间周期选择器
- [ ] 支持: 1m, 5m, 15m, 30m, 60m, 1D, 1W, 1M
- [ ] 切换时重新加载数据

### 3. 股票搜索
- [ ] 搜索框 (Autocomplete)
- [ ] 股票代码/名称搜索
- [ ] 搜索结果列表
- [ ] 点击进入图表

### 4. 股票信息栏
- [ ] 股票名称/代码
- [ ] 当前价格
- [ ] 涨跌幅
- [ ] 开盘价/最高价/最低价/昨收
- [ ] 成交量/成交额

### 5. 操作按钮
- [ ] 添加到自选股
- [ ] 分享
- [ ] 全屏模式

### 6. 技术指标 (可选 v2)
- [ ] MA (移动平均线)
- [ ] MACD
- [ ] RSI
- [ ] KDJ

## 数据结构

```typescript
interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  amount: number;
}
```

## API 接口

```typescript
GET /api/v1/kline?symbol={symbol}&timeframe={timeframe}&limit={limit}
GET /api/v1/kline/price?symbol={symbol}
POST /api/v1/watchlist  (添加到自选股)
```

## 组件设计

```typescript
// components/KlineChart.tsx
interface KlineChartProps {
  symbol: string;
  timeframe: string;
  data: KlineData[];
}

// components/StockSearch.tsx
interface StockSearchProps {
  onSelect: (symbol: string) => void;
}
```

## 验收标准

- [ ] K线图正常渲染
- [ ] 周期切换流畅
- [ ] 缩放/拖拽流畅
- [ ] 添加自选股成功
- [ ] 响应式适配

## 关联

依赖:
- #21 (项目初始化)
- #7 (后端 Kline API)
- #17 (后端分钟级 Kline)
