---
name: Frontend Watchlist
about: 自选股页面 - 股票列表/管理
labels: ["frontend", "watchlist"]
---

## 概述

实现自选股管理页面，支持添加/删除/排序自选股，实时显示价格。

## 任务清单

### 1. 自选股列表
- [ ] 表格展示自选股
- [ ] 列: 名称/代码/当前价/涨跌幅/操作
- [ ] 涨跌幅红绿颜色
- [ ] 实时价格更新 (轮询/WebSocket)
- [ ] 空状态 (无自选股提示)

### 2. 添加自选股
- [ ] 搜索框 (股票代码/名称)
- [ ] 搜索结果列表
- [ ] 点击添加
- [ ] 重复添加提示

### 3. 删除自选股
- [ ] 每行删除按钮
- [ ] 删除确认对话框
- [ ] 删除成功提示

### 4. 拖拽排序
- [ ] 拖拽手柄
- [ ] 拖拽排序功能
- [ ] 排序持久化 (调用 API)

### 5. 快捷操作
- [ ] 点击行跳转 K线图
- [ ] 批量删除
- [ ] 导入/导出 (可选)

### 6. 备注功能
- [ ] 每行备注图标
- [ ] 编辑备注弹窗
- [ ] 备注显示

## 数据结构

```typescript
interface WatchlistItem {
  id: number;
  market: string;
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  notes?: string;
  sortOrder: number;
  createdAt: string;
}
```

## API 接口

```typescript
GET    /api/v1/watchlist
POST   /api/v1/watchlist
DELETE /api/v1/watchlist/{id}
PUT    /api/v1/watchlist/sort
PUT    /api/v1/watchlist/{id}/notes
GET    /api/v1/a-share/search?keyword={keyword}
```

## UI 设计

- 表格: 斑马纹, hover 效果
- 操作列: 编辑备注/删除图标
- 搜索框: 顶部固定
- 添加按钮: 右上角

## 验收标准

- [ ] 列表正常显示
- [ ] 添加/删除成功
- [ ] 拖拽排序生效
- [ ] 价格实时更新
- [ ] 响应式适配

## 关联

依赖:
- #21 (项目初始化)
- #8 (后端 Watchlist API)
