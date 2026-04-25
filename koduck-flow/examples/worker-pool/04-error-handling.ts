/**
 * 示例 4: 错误处理与恢复
 * 演示如何正确处理任务失败和系统错误
 */

import { WorkerPoolManager } from "@/common/worker-pool";

class TaskWithRetry {
  constructor(
    private manager: WorkerPoolManager,
    private maxRetries: number = 3
  ) {
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    // 监听任务失败事件
    this.manager.on("task:failed", (event) => {
      console.error(`Task ${event.taskId} failed: ${event.error.message}`);
    });

    // 监听 Worker 失败事件
    this.manager.on("worker:failed", (event) => {
      console.error(`Worker ${event.workerId} failed`);
    });

    // 监听背压事件
    this.manager.on("backpressure:started", () => {
      console.warn("⚠️ Queue backpressured - reducing submission rate");
    });

    this.manager.on("backpressure:recovered", () => {
      console.log("✅ Queue recovered - resuming normal rate");
    });
  }

  async submitWithRetry(taskSpec: any) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempting task (${attempt}/${this.maxRetries})...`);

        const result = await this.manager.submit({
          ...taskSpec,
          timeout: taskSpec.timeout || 30000,
        });

        console.log(`✅ Task succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`❌ Attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < this.maxRetries) {
          // 指数退避：第一次等待 100ms，第二次 200ms，第三次 400ms
          const delay = Math.pow(2, attempt - 1) * 100;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Task failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  async submitWithFallback(taskSpec: any, fallbackFn: () => Promise<any>) {
    try {
      return await this.manager.submit(taskSpec);
    } catch (error) {
      console.warn(`Task failed, using fallback: ${(error as Error).message}`);
      return await fallbackFn();
    }
  }
}

async function errorHandlingExample() {
  console.log("=== Example 4: Error Handling & Recovery ===\n");

  const manager = new WorkerPoolManager({
    workerCount: 2,
    defaultTaskTimeout: 30000,
    maxTaskRetries: 1, // 基本重试
  });

  await manager.initialize();

  const taskHelper = new TaskWithRetry(manager, 3);

  try {
    // 示例 1: 带重试的任务提交
    console.log("--- Test 1: Task with built-in retry ---\n");

    try {
      const result = await taskHelper.submitWithRetry({
        type: "potentially-failing-task",
        payload: { value: 42 },
      });

      console.log("Final result:", result);
    } catch (error) {
      console.error("All retries exhausted:", error);
    }

    console.log("\n--- Test 2: Task with fallback ---\n");

    // 示例 2: 带回退的任务提交
    const result = await taskHelper.submitWithFallback(
      {
        type: "compute",
        payload: { value: 100 },
      },
      async () => {
        console.log("Using fallback computation...");
        return { result: 42, fromFallback: true };
      }
    );

    console.log("Result:", result);

    // 示例 3: 错误处理最佳实践
    console.log("\n--- Test 3: Best practice error handling ---\n");

    try {
      const tasks = [
        { type: "task", payload: { id: 1 } },
        { type: "task", payload: { id: 2 } },
        { type: "task", payload: { id: 3 } },
      ];

      const results = await manager.submitBatch(tasks);

      // 检查结果中的错误
      for (const [index, result] of results.entries()) {
        if (result.error) {
          console.error(`Task ${index} failed: ${result.error.message}`);
          // 实现专门的错误处理逻辑
        } else {
          console.log(`Task ${index} succeeded with result:`, result);
        }
      }
    } catch (error) {
      console.error("Batch submission failed:", error);
    }
  } finally {
    await manager.dispose();
  }
}

errorHandlingExample().catch(console.error);
