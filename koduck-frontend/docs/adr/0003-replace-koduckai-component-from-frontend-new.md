# ADR-0003: 使用 frontend-new 的 KoduckAi 组件替换现有实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关 Issue**: #712

---

## 背景与问题陈述

当前 `koduck-frontend` 中的 `KoduckAi` 组件需要与 `koduck-quant-frontend-new` 保持一致，以复用新版本页面结构和交互细节，减少两套前端实现差异。

---

## 决策

将 `koduck-quant-frontend-new/src/app/components/KoduckAi.tsx` 原样替换到
`koduck-frontend/src/app/components/KoduckAi.tsx`。

---

## 权衡

### 优点

- 快速对齐新版本 AI 页面实现。
- 降低维护两套组件差异的成本。
- 组件依赖不新增，迁移风险可控。

### 代价

- 当前仓库内原有 `KoduckAi` 样式细节会被新实现覆盖。

---

## 兼容性影响

- 路由与登录流程不变，仍使用 `/koduck-ai` 作为 AI 页面入口。
- 仅替换组件内部渲染与样式，不变更接口契约。

---

## 实施摘要

- 复制替换 `KoduckAi.tsx`。
- 执行构建、部署重启和登录回归验证。
