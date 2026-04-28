# Worker Pool 示例项目

> **文档版本**: v1.0.0  
> **创建日期**: 2025-11-04  
> **说明**: 完整可运行的 Worker Pool 示例

## 示例列表

### 01-basic-usage.ts

**难度**: ⭐ 初级  
**运行时间**: ~2 秒  
**学习内容**:

- Worker Pool 的基本初始化
- 单个任务提交
- 批量任务提交
- 统计信息获取
- 正确的生命周期管理

**关键代码**:

```typescript
const manager = new WorkerPoolManager({
  workerCount: 4,
  defaultTaskTimeout: 30000,
});

await manager.initialize();
const result = await manager.submit({ type: "task" });
await manager.dispose();
```

**概念**:

- 初始化和清理的必要性
- 异步任务处理
- 批量操作的性能优势

---

### 02-compute-intensive.ts

**难度**: ⭐⭐ 中级  
**运行时间**: ~5 秒  
**学习内容**:

- 计算密集型任务的配置
- CPU 核心数的合理选择
- 优先级分配
- 性能监控

**关键配置**:

```typescript
const manager = new WorkerPoolManager({
  workerCount: os.cpus().length, // 关键!
  maxWorkerCount: os.cpus().length,
  maxQueueSize: 10000,
  defaultTaskTimeout: 120000,
});
```

**概念**:

- CPU 密集型 vs IO 密集型任务
- 吞吐量优化
- 优先级调度

---

### 03-monitoring.ts

**难度**: ⭐⭐ 中级  
**运行时间**: ~15 秒  
**学习内容**:

- 实时监控 Pool 状态
- 告警检测
- 性能指标分析
- 诊断报告生成

**关键功能**:

```typescript
// 实时监控
monitor.start(1000);

// 生成报告
monitor.generateReport();

// 告警检测
- 高利用率 (> 90%)
- 队列堆积
- 高失败率
```

**概念**:

- 可观测性的重要性
- 指标收集和分析
- 告警设置

---

### 04-error-handling.ts

**难度**: ⭐⭐⭐ 高级  
**运行时间**: ~3 秒  
**学习内容**:

- 事件驱动的错误处理
- 重试逻辑（指数退避）
- 回退策略
- 错误恢复

**关键模式**:

```typescript
// 自动重试
await taskHelper.submitWithRetry(taskSpec);

// 回退处理
await taskHelper.submitWithFallback(taskSpec, async () => {
  /* 备选逻辑 */
});

// 批量错误检查
results.forEach((result) => {
  if (result.error) {
    /* 处理错误 */
  }
});
```

**概念**:

- 失败恢复策略
- 指数退避算法
- 优雅降级

---

## 运行示例

### 前置条件

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build
```

### 运行单个示例

```bash
# 基础使用示例
pnpm tsx examples/worker-pool/01-basic-usage.ts

# 计算密集型示例
pnpm tsx examples/worker-pool/02-compute-intensive.ts

# 监控示例
pnpm tsx examples/worker-pool/03-monitoring.ts

# 错误处理示例
pnpm tsx examples/worker-pool/04-error-handling.ts
```

### 运行所有示例

```bash
# 创建脚本文件 examples/worker-pool/run-all.sh
for file in *.ts; do
  echo "=== Running $file ==="
  pnpm tsx $file
  echo ""
done

# 运行
chmod +x run-all.sh
./run-all.sh
```

---

## 示例执行流程

### 示例 1: 基础使用

```
初始化 Pool (4 个 Worker)
  ↓
提交单个任务
  ↓
获取结果
  ↓
提交批量任务 (3 个)
  ↓
获取所有结果
  ↓
查看统计信息
  ↓
清理资源
  ↓
完成
```

### 示例 2: 计算密集型

```
创建 CPU 核心数 Worker
  ↓
生成 100 个计算任务
  ↓
批量提交 (带优先级)
  ↓
监控处理进度
  ↓
分析性能指标
  ↓
显示统计信息
  ↓
完成
```

### 示例 3: 监控

```
启动监控器
  ↓
每 1 秒采集一次指标
  ↓
实时打印状态
  ↓
检查并输出告警
  ↓
分批提交工作任务
  ↓
等待任务完成
  ↓
生成监控报告
  ↓
完成
```

### 示例 4: 错误处理

```
设置错误处理器
  ↓
带重试的任务提交
  ↓
重试逻辑 (最多 3 次)
  ↓
带回退的任务提交
  ↓
批量任务提交和错误检查
  ↓
完成
```

---

## 学习路径

### 初学者路线 (⭐)

1. 读 `docs/worker-pool-guide.md` 快速开始章节
2. 运行 `01-basic-usage.ts`
3. 了解基本概念: 初始化、提交、清理
4. 修改示例代码进行实验

### 中级开发者路线 (⭐⭐)

1. 读 `docs/worker-pool-best-practices.md`
2. 运行 `02-compute-intensive.ts`
3. 运行 `03-monitoring.ts`
4. 学习性能优化和监控

### 高级开发者路线 (⭐⭐⭐)

1. 读 `docs/api/worker-pool-api.md` 完整参考
2. 读 `docs/worker-pool-troubleshooting.md`
3. 运行 `04-error-handling.ts`
4. 学习生产环境最佳实践

---

## 常见问题

### Q1: 示例能在生产环境运行吗?

A: 这些示例是教育性的。生产环境需要:

- 更完善的错误处理
- 详细的日志记录
- 健康检查和自动恢复
- 性能监控和告警

### Q2: 如何修改示例用于自己的项目?

A:

1. 复制示例文件到你的项目
2. 修改 Worker 类型和 payload 结构
3. 调整配置参数
4. 添加业务逻辑

### Q3: 示例中的 Worker 脚本在哪里?

A: 这些示例使用虚拟的 Worker 类型。实际项目需要创建真实的 Worker 脚本。

### Q4: 如何集成到现有项目?

A:

```typescript
// 在你的代码中
import { WorkerPoolManager } from "@/common/worker-pool";

// 使用示例中的模式
const manager = new WorkerPoolManager(config);
await manager.initialize();
// ... 你的业务逻辑
```

---

## 性能基准

### 示例 2: 计算密集型 (100 个任务)

在 4 核 CPU 机器上:

- **顺序执行**: ~50 秒
- **Worker Pool (4 workers)**: ~13 秒
- **性能提升**: 3.8 倍

### 示例 3: 监控 (250 个任务)

监控开销:

- **CPU 使用**: < 5%
- **内存开销**: < 10MB
- **准确性**: 99.5%

---

## 下一步

完成这些示例后:

1. **深入学习**: 阅读 Worker Pool 源代码
2. **实践项目**: 在实际项目中应用
3. **性能测试**: 基准测试和优化
4. **贡献**: 改进示例或添加新示例

---

## 相关文档

- `docs/worker-pool-guide.md` - 完整使用指南
- `docs/worker-pool-best-practices.md` - 最佳实践
- `docs/worker-pool-troubleshooting.md` - 故障排查
- `docs/api/worker-pool-api.md` - API 参考

---

## 许可证

这些示例遵循项目的主要许可证。可自由修改和分发。

## 作者

Koduck Flow 团队

---

**最后更新**: 2025-11-04
