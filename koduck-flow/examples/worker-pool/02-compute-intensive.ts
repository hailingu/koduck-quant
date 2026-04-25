/**
 * 示例 2: 计算密集型任务处理
 * 演示如何处理 CPU 密集的计算任务
 */

import { WorkerPoolManager } from "@/common/worker-pool";
import os from "os";

interface ComputePayload {
  numbers: number[];
  operation: "sum" | "average" | "sort";
}

async function computeIntensiveExample() {
  console.log("=== Example 2: Compute Intensive Tasks ===\n");

  // 为计算密集型任务优化配置
  const manager = new WorkerPoolManager({
    workerCount: os.cpus().length, // 使用 CPU 核心数
    maxWorkerCount: os.cpus().length,
    maxQueueSize: 10000,
    defaultTaskTimeout: 120000, // 较长超时
  });

  await manager.initialize();

  try {
    console.log(`Using ${os.cpus().length} workers for CPU-intensive tasks\n`);

    // 生成测试数据
    const testData: ComputePayload[] = [];
    for (let i = 0; i < 100; i++) {
      testData.push({
        numbers: Array.from({ length: 10000 }, () => Math.random() * 1000),
        operation: ["sum", "average", "sort"][i % 3] as any,
      });
    }

    console.log(`Processing ${testData.length} compute-intensive tasks...`);

    // 批量提交任务
    const tasks = testData.map((data, index) => ({
      type: "compute",
      payload: data,
      priority: Math.floor(index / 20), // 前面的任务优先级高
    }));

    const startTime = Date.now();
    const results = await manager.submitBatch(tasks);
    const duration = Date.now() - startTime;

    console.log(`\nProcessing completed in ${duration}ms`);

    // 分析结果
    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    console.log(`Results: ${successful} succeeded, ${failed} failed`);

    // 显示最终统计
    const stats = manager.getStats();
    console.log(`\nFinal statistics:`);
    console.log(`  Total tasks processed: ${stats.completedTasks}`);
    console.log(`  Average task time: ${stats.averageTaskDuration.toFixed(2)}ms`);
    console.log(`  Worker utilization: ${(stats.utilization * 100).toFixed(1)}%`);
  } finally {
    await manager.dispose();
  }
}

// 运行示例
computeIntensiveExample().catch(console.error);
