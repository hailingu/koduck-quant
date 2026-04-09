# ADR-0004: 将 KoduckAi 页面内容迁移为 frontend-new ChatPage 实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-10
- **作者**: @hailingu
- **相关 Issue**: #714

---

## 背景与问题陈述

`koduck-quant-frontend-new` 已拆分出 `ChatPage.tsx` 作为重构版 AI 对话内容实现，而当前 `koduck-frontend` 的 `KoduckAi.tsx` 仍是简化版输入页。

为了按重构路径逐步替换，需要将 `ChatPage` 的内容逻辑迁移到当前系统实际入口组件 `KoduckAi`。

---

## 决策

采用“内容迁移、组件名不变”策略：

- 将 `frontend-new` 的 `ChatPage` 内容迁移到 `koduck-frontend/src/app/components/KoduckAi.tsx`
- 保持路由与组件命名不变（`/koduck-ai -> KoduckAi`）
- 不在本次变更中引入 `ChatPage` 新路由，避免额外行为变化

---

## 权衡

### 优点

- 最大化复用重构版对话逻辑（消息列表、卡片回复、时间戳、底部输入区）
- 降低路由层变更风险，保持现有登录与鉴权流程稳定
- 便于后续继续逐步替换其他页面

### 代价

- 组件命名与语义会暂时不一致（`KoduckAi` 内部为 ChatPage 结构）

---

## 兼容性影响

- `/koduck-ai` 路由保持不变
- 其他页面路由与布局不受影响

---

## 实施摘要

- 迁移 `ChatPage` 内容到 `KoduckAi.tsx`
- 执行构建、部署重启、登录回归验证
