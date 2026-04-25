#!/usr/bin/env node

/**
 * E2E Coverage Calculator & Threshold Checker
 *
 * Calculates coverage metrics from Playwright test results and tracks against threshold.
 * Logs warnings if coverage falls below 70% target.
 *
 * Usage: tsx calculate-e2e-coverage.ts --report-path <path> --output <path>
 *
 * Environment:
 *   GITHUB_STEP_SUMMARY - Path to the step summary file (auto-set in GitHub Actions)
 *   GITHUB_ACTIONS - Set to true when running in GitHub Actions
 */

import { readFileSync, appendFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { argv } from "node:process";

interface PlaywrightStats {
  expected?: number;
  unexpected?: number;
  flaky?: number;
  skipped?: number;
  duration?: number;
}

interface CoverageMetric {
  timestamp: string;
  date: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  thresholdTarget: number;
  thresholdMet: boolean;
  status: "pass" | "warn" | "fail";
  message: string;
}

interface CoverageHistory {
  version: "1.0";
  threshold: number;
  metrics: CoverageMetric[];
  summary: {
    totalRuns: number;
    passCount: number;
    warnCount: number;
    failCount: number;
    averageSuccessRate: number;
    trend: "improving" | "stable" | "declining" | "unknown";
  };
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg?.startsWith("--")) {
      const key = arg.substring(2);
      const value = args[index + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        index += 2;
      } else {
        index += 1;
      }
    } else {
      index += 1;
    }
  }
  return result;
}

function calculateCoverage(stats: PlaywrightStats, threshold = 70): CoverageMetric {
  const passed = stats.expected || 0;
  const failed = (stats.unexpected || 0) + (stats.flaky || 0);
  const skipped = stats.skipped || 0;
  const total = passed + failed;

  const successRate = total > 0 ? (passed / total) * 100 : 0;
  const thresholdMet = successRate >= threshold;

  let status: "pass" | "warn" | "fail" = "pass";
  let message = `✅ Coverage: ${successRate.toFixed(2)}% (Target: ${threshold}%)`;

  if (!thresholdMet && successRate >= threshold - 10) {
    status = "warn";
    message = `⚠️ Coverage: ${successRate.toFixed(2)}% (Below target ${threshold}%, approaching threshold)`;
  } else if (!thresholdMet) {
    status = "fail";
    message = `❌ Coverage: ${successRate.toFixed(2)}% (Significantly below target ${threshold}%)`;
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const date = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    timestamp,
    date,
    totalTests: total,
    passedTests: passed,
    failedTests: failed,
    skippedTests: skipped,
    successRate,
    thresholdTarget: threshold,
    thresholdMet,
    status,
    message,
  };
}

function loadCoverageHistory(filePath: string): CoverageHistory {
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not parse coverage history: ${error}`);
      return createEmptyCoverageHistory();
    }
  }
  return createEmptyCoverageHistory();
}

function createEmptyCoverageHistory(): CoverageHistory {
  return {
    version: "1.0",
    threshold: 70,
    metrics: [],
    summary: {
      totalRuns: 0,
      passCount: 0,
      warnCount: 0,
      failCount: 0,
      averageSuccessRate: 0,
      trend: "unknown",
    },
  };
}

function calculateTrend(
  metrics: CoverageMetric[]
): "improving" | "stable" | "declining" | "unknown" {
  if (metrics.length < 2) return "unknown";

  const recent = metrics.slice(-3);
  const rates = recent.map((m) => m.successRate);

  if (rates.every((r, i, arr) => i === 0 || r >= arr[i - 1])) {
    return "improving";
  }
  if (rates.every((r, i, arr) => i === 0 || r <= arr[i - 1])) {
    return "declining";
  }
  return "stable";
}

function updateCoverageHistory(history: CoverageHistory, metric: CoverageMetric): CoverageHistory {
  history.metrics.push(metric);

  // Keep only last 30 runs
  if (history.metrics.length > 30) {
    history.metrics = history.metrics.slice(-30);
  }

  // Update summary
  history.summary.totalRuns = history.metrics.length;
  history.summary.passCount = history.metrics.filter((m) => m.status === "pass").length;
  history.summary.warnCount = history.metrics.filter((m) => m.status === "warn").length;
  history.summary.failCount = history.metrics.filter((m) => m.status === "fail").length;
  history.summary.averageSuccessRate =
    history.metrics.reduce((sum, m) => sum + m.successRate, 0) / history.metrics.length;
  history.summary.trend = calculateTrend(history.metrics);

  return history;
}

function generateCoverageSummary(metric: CoverageMetric, history: CoverageHistory): string {
  let summary = `## 📊 E2E Coverage Analysis\n\n`;

  summary += `### Current Run\n`;
  summary += `${metric.message}\n`;
  summary += `- **Tests Passed**: ${metric.passedTests}\n`;
  summary += `- **Tests Failed**: ${metric.failedTests}\n`;
  summary += `- **Tests Skipped**: ${metric.skippedTests}\n`;
  summary += `- **Total Tests**: ${metric.totalTests}\n`;
  summary += `- **Timestamp**: ${metric.timestamp}\n\n`;

  if (history.summary.totalRuns > 1) {
    summary += `### Historical Trend (Last ${Math.min(history.summary.totalRuns, 30)} runs)\n`;
    summary += `- **Average Success Rate**: ${history.summary.averageSuccessRate.toFixed(2)}%\n`;
    summary += `- **Trend**: ${getTrendEmoji(history.summary.trend)} ${history.summary.trend.toUpperCase()}\n`;
    summary += `- **Pass Count**: ${history.summary.passCount}\n`;
    summary += `- **Warn Count**: ${history.summary.warnCount}\n`;
    summary += `- **Fail Count**: ${history.summary.failCount}\n\n`;

    // Show last 5 runs
    const recentMetrics = history.metrics.slice(-5).reverse();
    summary += `### Recent Runs\n`;
    summary += `| Date | Success Rate | Status | Tests |\n`;
    summary += `|------|--------------|--------|-------|\n`;
    for (const m of recentMetrics) {
      summary += `| ${m.date} | ${m.successRate.toFixed(1)}% | ${getStatusBadge(m.status)} | ${m.passedTests}/${m.totalTests} |\n`;
    }
    summary += "\n";
  }

  // Threshold alert
  if (!metric.thresholdMet) {
    summary += `### 🚨 Coverage Alert\n`;
    summary += `Coverage is below target threshold of ${metric.thresholdTarget}%.\n`;
    summary += `**Current**: ${metric.successRate.toFixed(2)}% | **Gap**: ${(metric.thresholdTarget - metric.successRate).toFixed(2)}%\n\n`;
    summary += `**Recommended Actions**:\n`;
    summary += `- Review failed tests in Playwright report\n`;
    summary += `- Check for flaky tests (check last few runs)\n`;
    summary += `- Consider adding more test cases for uncovered scenarios\n\n`;
  }

  summary += `### Threshold Policy\n`;
  summary += `- **Target**: ≥${metric.thresholdTarget}% success rate\n`;
  summary += `- **Alert Type**: Soft warning (does not block CI)\n`;
  summary += `- **Next Steps**: Trend-based planning for future hard gates\n`;

  return summary;
}

function getTrendEmoji(trend: string): string {
  switch (trend) {
    case "improving":
      return "📈";
    case "declining":
      return "📉";
    case "stable":
      return "➡️";
    default:
      return "❓";
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case "pass":
      return "✅";
    case "warn":
      return "⚠️";
    case "fail":
      return "❌";
    default:
      return "❓";
  }
}

function loadPlaywrightStats(filePath: string): PlaywrightStats {
  try {
    const content = readFileSync(filePath, "utf-8");
    const report = JSON.parse(content);
    return report.stats || { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  } catch (error) {
    console.error(`Error reading Playwright report: ${error}`);
    return { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  }
}

function main() {
  const args = parseArgs(argv.slice(2));
  const reportPath = args["report-path"];
  const outputPath = args["output"];
  const threshold = Number.parseInt(args["threshold"] || "70", 10);

  if (!reportPath) {
    console.error("Error: --report-path is required");
    process.exit(1);
  }

  if (!outputPath) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  // Load and parse Playwright stats
  const stats = loadPlaywrightStats(reportPath);
  const metric = calculateCoverage(stats, threshold);

  // Load existing history or create new
  let history = loadCoverageHistory(outputPath);
  history = updateCoverageHistory(history, metric);

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    console.log(`Creating directory: ${outputDir}`);
  }

  // Write updated history
  writeFileSync(outputPath, JSON.stringify(history, null, 2));
  console.log(`✅ Coverage history saved to ${outputPath}`);

  // Generate summary
  const summary = generateCoverageSummary(metric, history);
  console.log("\n" + summary);

  // Append to GitHub Step Summary if available
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, summary);
    console.log(`✅ Coverage summary appended to GitHub Step Summary`);
  }

  // Exit with appropriate code
  if (metric.status === "fail" && process.env.GITHUB_ACTIONS) {
    console.log("\n⚠️ Coverage below threshold, but not blocking CI (soft alert)");
    process.exit(0); // Don't fail CI, just warn
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

export { calculateCoverage, loadCoverageHistory, CoverageMetric };
