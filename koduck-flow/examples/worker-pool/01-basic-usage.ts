/**
 * 示例 1: 基础使用
 * 展示 Worker Pool 的最基本用法
 */

import { WorkerPoolManager } from "@/common/worker-pool";

async function basicUsageExample() {
  console.log("=== Example 1: Basic Usage ===\n");

  // 创建并初始化 Pool
  const manager = new WorkerPoolManager({
    workerCount: 4,
    defaultTaskTimeout: 30000,
  });

  await manager.initialize();

  try {
    // 提交单个任务
    console.log("Submitting a single task...");
    const result = await manager.submit({
      type: "calculate",
      payload: { value: 42 },
    });

    console.log("Task result:", result);

    // 提交多个任务
    console.log("\nSubmitting batch tasks...");
    const tasks = [
      { type: "process", payload: { id: 1 } },
      { type: "process", payload: { id: 2 } },
      { type: "process", payload: { id: 3 } },
    ];

    const batchResults = await manager.submitBatch(tasks);
    console.log("Batch results:", batchResults);

    // 获取统计信息
    console.log("\nPool statistics:");
    const stats = manager.getStats();
    console.log(`  Completed tasks: ${stats.completedTasks}`);
    console.log(`  Failed tasks: ${stats.failedTasks}`);
    console.log(`  Active workers: ${stats.activeWorkers}/${stats.totalWorkers}`);
  } finally {
    // 总是进行清理
    await manager.dispose();
    console.log("\nPool disposed");
  }
}

// 运行示例
basicUsageExample().catch(console.error);
