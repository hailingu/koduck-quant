/**
 * 示例 3: 监控与诊断
 * 演示如何监控 Pool 的状态并进行诊断
 */

import { WorkerPoolManager } from "@/common/worker-pool";
import os from "node:os";

interface MonitorMetrics {
  timestamp: Date;
  activeWorkers: number;
  totalWorkers: number;
  utilization: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgDuration: number;
}

class PoolMonitor {
  private metrics: MonitorMetrics[] = [];
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(private manager: WorkerPoolManager) {}

  start(intervalMs: number = 1000) {
    console.log("Starting pool monitoring...\n");

    this.monitorInterval = setInterval(() => {
      const stats = manager.getStats();

      const metric: MonitorMetrics = {
        timestamp: new Date(),
        activeWorkers: stats.activeWorkers,
        totalWorkers: stats.totalWorkers,
        utilization: stats.utilization,
        queuedTasks: stats.queuedTasks,
        completedTasks: stats.completedTasks,
        failedTasks: stats.failedTasks,
        avgDuration: stats.averageTaskDuration,
      };

      this.metrics.push(metric);

      // 打印当前状态
      this.printStatus(metric);

      // 检查告警
      this.checkAlerts(metric);

      // 只保留最近 100 个指标
      if (this.metrics.length > 100) {
        this.metrics.shift();
      }
    }, intervalMs);
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private printStatus(metric: MonitorMetrics) {
    const time = metric.timestamp.toLocaleTimeString();
    const bar = this.getUtilizationBar(metric.utilization);

    console.log(`[${time}] Pool Status:`);
    console.log(`  Workers: ${metric.activeWorkers}/${metric.totalWorkers} ${bar}`);
    console.log(`  Queue: ${metric.queuedTasks} tasks`);
    console.log(`  Completed: ${metric.completedTasks} | Failed: ${metric.failedTasks}`);
    console.log(`  Avg Duration: ${metric.avgDuration.toFixed(2)}ms\n`);
  }

  private checkAlerts(metric: MonitorMetrics) {
    const alerts: string[] = [];

    if (metric.utilization > 0.9) {
      alerts.push("⚠️  HIGH UTILIZATION - Consider adding workers");
    }

    if (metric.queuedTasks > metric.totalWorkers * 100) {
      alerts.push("⚠️  QUEUE BACKLOG - Tasks piling up");
    }

    if (metric.failedTasks > 0 && metric.completedTasks > 0) {
      const failureRate = metric.failedTasks / (metric.completedTasks + metric.failedTasks);
      if (failureRate > 0.05) {
        alerts.push(`⚠️  HIGH FAILURE RATE - ${(failureRate * 100).toFixed(1)}% tasks failing`);
      }
    }

    if (alerts.length > 0) {
      console.log("ALERTS:");
      alerts.forEach((alert) => console.log(`  ${alert}`));
      console.log();
    }
  }

  private getUtilizationBar(utilization: number) {
    const filledLength = Math.round(utilization * 10);
    const bar = "█".repeat(filledLength) + "░".repeat(10 - filledLength);
    const color = utilization > 0.9 ? "🔴" : utilization > 0.7 ? "🟡" : "🟢";
    return `${color} [${bar}] ${(utilization * 100).toFixed(1)}%`;
  }

  generateReport() {
    if (this.metrics.length === 0) {
      console.log("No metrics collected yet");
      return;
    }

    console.log("\n=== Monitoring Report ===\n");

    const utilizations = this.metrics.map((m) => m.utilization);
    const avgUtil = utilizations.reduce((a, b) => a + b) / utilizations.length;
    const maxUtil = Math.max(...utilizations);
    const minUtil = Math.min(...utilizations);

    console.log("Utilization Statistics:");
    console.log(`  Average: ${(avgUtil * 100).toFixed(1)}%`);
    console.log(`  Max: ${(maxUtil * 100).toFixed(1)}%`);
    console.log(`  Min: ${(minUtil * 100).toFixed(1)}%`);

    const lastMetric = this.metrics[this.metrics.length - 1];
    console.log(`\nFinal Status:`);
    console.log(`  Total tasks: ${lastMetric.completedTasks + lastMetric.failedTasks}`);
    console.log(
      `  Success rate: ${((lastMetric.completedTasks / (lastMetric.completedTasks + lastMetric.failedTasks)) * 100).toFixed(1)}%`
    );
    console.log(`  Current queue: ${lastMetric.queuedTasks}`);
  }
}

async function monitoringExample() {
  console.log("=== Example 3: Monitoring & Diagnostics ===\n");

  const manager = new WorkerPoolManager({
    workerCount: 4,
    maxQueueSize: 10000,
  });

  await manager.initialize();

  const monitor = new PoolMonitor(manager);
  monitor.start(1000); // 每秒更新一次

  try {
    // 模拟工作负载
    console.log("Submitting tasks...\n");

    for (let batch = 0; batch < 5; batch++) {
      const tasks = Array.from({ length: 50 }, (_, i) => ({
        type: "work",
        payload: { taskId: batch * 50 + i },
      }));

      manager.submitBatch(tasks).catch(console.error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // 让所有任务完成
    console.log("Waiting for tasks to complete...\n");
    await new Promise((resolve) => setTimeout(resolve, 10000));
  } finally {
    monitor.stop();
    monitor.generateReport();

    await manager.dispose();
  }
}

monitoringExample().catch(console.error);
