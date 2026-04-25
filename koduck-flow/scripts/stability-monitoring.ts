#!/usr/bin/env node

/**
 * Stability Monitoring Script for E2E Tests
 *
 * This script monitors the stability of E2E tests over time,
 * tracking metrics like success rates, execution times, and failure patterns.
 *
 * Usage:
 *   node scripts/stability-monitoring.ts [options]
 *
 * Options:
 *   --runs number     Number of test runs to perform (default: 10)
 *   --suite pattern   Test suite pattern to run (default: "test/e2e\/**\/*.spec.ts")
 *   --output file     Output file for results (default: "stability-report.json")
 *   --threshold rate  Minimum success rate threshold (default: 0.95)
 */

import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseCliArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.split("=", 2);
    const key = rawKey.replace(/^--/, "");

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      i += 1;
    } else {
      parsed[key] = "true";
    }
  }

  return parsed;
}

interface PlaywrightTestResultEntry {
  status: string;
  error?: { message?: string };
}

interface PlaywrightTestCase {
  title: string;
  state?: string;
  err?: { message?: string };
  results?: PlaywrightTestResultEntry[];
}

interface PlaywrightSpec {
  title: string;
  tests?: PlaywrightTestCase[];
}

interface PlaywrightSuite {
  title?: string;
  tests?: PlaywrightTestCase[];
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
  stats?: {
    passes?: number;
    failures?: number;
    pending?: number;
  };
}

interface TestResult {
  runId: number;
  timestamp: string;
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  successRate: number;
  failedTests: string[];
  errorMessages: string[];
}

interface StabilityReport {
  summary: {
    totalRuns: number;
    averageSuccessRate: number;
    minSuccessRate: number;
    maxSuccessRate: number;
    averageDuration: number;
    stabilityScore: number; // 0-100, higher is better
    flakyTests: string[];
  };
  runs: TestResult[];
  recommendations: string[];
}

class StabilityMonitor {
  private results: TestResult[] = [];
  private options: {
    runs: number;
    suite: string;
    output: string;
    threshold: number;
  };

  constructor() {
    const cliArgs = parseCliArgs();
    this.options = {
      runs: Number.parseInt(cliArgs.runs ?? "10", 10),
      suite: cliArgs.suite ?? "test/e2e/**/*.spec.ts",
      output: cliArgs.output ?? "stability-report.json",
      threshold: Number.parseFloat(cliArgs.threshold ?? "0.95"),
    };

    if (Number.isNaN(this.options.runs) || this.options.runs <= 0) {
      this.options.runs = 10;
    }

    if (Number.isNaN(this.options.threshold) || this.options.threshold <= 0) {
      this.options.threshold = 0.95;
    }
  }

  async run(): Promise<void> {
    console.log("🚀 Starting E2E Stability Monitoring");
    console.log(`📊 Configuration: ${this.options.runs} runs, suite: ${this.options.suite}`);
    console.log(`🎯 Success threshold: ${(this.options.threshold * 100).toFixed(1)}%`);
    console.log("");

    for (let i = 0; i < this.options.runs; i++) {
      console.log(`🏃 Run ${i + 1}/${this.options.runs}`);
      const result = await this.runTestSuite(i + 1);
      this.results.push(result);

      const status = result.successRate >= this.options.threshold ? "✅" : "❌";
      console.log(
        `${status} Success rate: ${(result.successRate * 100).toFixed(1)}% (${result.passed}/${result.total})`
      );
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log("");
    }

    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);
  }

  private async runTestSuite(runId: number): Promise<TestResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const testProcess = spawn(
        "npx",
        ["playwright", "test", this.options.suite, "--reporter=json"],
        {
          cwd: join(__dirname, ".."),
          stdio: ["inherit", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";

      testProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      testProcess.on("close", () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        try {
          const report = JSON.parse(stdout) as PlaywrightReport;
          const aggregatedStats = this.calculateStats(report);
          const result: TestResult = {
            runId,
            timestamp: new Date().toISOString(),
            duration,
            passed: aggregatedStats.passed,
            failed: aggregatedStats.failed,
            skipped: aggregatedStats.skipped,
            total: aggregatedStats.total,
            successRate: 0,
            failedTests: [],
            errorMessages: [],
          };

          result.successRate = result.total > 0 ? result.passed / result.total : 0;

          // Extract failed tests and error messages
          this.extractFailures(report.suites ?? [], result);

          resolve(result);
        } catch (error) {
          console.error("Failed to parse test output:", error);
          resolve({
            runId,
            timestamp: new Date().toISOString(),
            duration,
            passed: 0,
            failed: 1,
            skipped: 0,
            total: 1,
            successRate: 0,
            failedTests: ["Test execution failed"],
            errorMessages: [stderr || "Unknown error"],
          });
        }
      });
    });
  }

  private extractFailures(suites: PlaywrightSuite[], result: TestResult): void {
    this.iterateTestResults(suites, ({ titlePath, status, errorMessage }) => {
      if (status !== "passed" && status !== "skipped") {
        result.failedTests.push(titlePath);
        if (errorMessage) {
          result.errorMessages.push(errorMessage);
        }
      }
    });
  }

  private calculateStats(report: PlaywrightReport): {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  } {
    const initialStats = {
      passed: report.stats?.passes ?? 0,
      failed: report.stats?.failures ?? 0,
      skipped: report.stats?.pending ?? 0,
    };

    if (initialStats.passed + initialStats.failed + initialStats.skipped > 0) {
      return {
        ...initialStats,
        total: initialStats.passed + initialStats.failed + initialStats.skipped,
      };
    }

    const counters = { passed: 0, failed: 0, skipped: 0 };

    this.iterateTestResults(report.suites ?? [], ({ status }) => {
      switch (status) {
        case "passed":
          counters.passed += 1;
          break;
        case "skipped":
        case "interrupted":
          counters.skipped += 1;
          break;
        default:
          counters.failed += 1;
          break;
      }
    });

    return {
      ...counters,
      total: counters.passed + counters.failed + counters.skipped,
    };
  }

  private iterateTestResults(
    suites: PlaywrightSuite[],
    callback: (info: { titlePath: string; status: string; errorMessage?: string }) => void,
    parents: string[] = []
  ): void {
    for (const suite of suites) {
      const currentParents = suite.title ? [...parents, suite.title] : parents;

      if (suite.tests) {
        for (const test of suite.tests) {
          const titlePath = [...currentParents, test.title].join(" > ");
          if (test.results && test.results.length > 0) {
            for (const result of test.results) {
              callback({
                titlePath,
                status: result.status,
                errorMessage: result.error?.message ?? test.err?.message,
              });
            }
          } else {
            callback({
              titlePath,
              status: test.state ?? "unknown",
              errorMessage: test.err?.message,
            });
          }
        }
      }

      if (suite.specs) {
        for (const spec of suite.specs) {
          const specParents = spec.title ? [...currentParents, spec.title] : currentParents;
          if (spec.tests) {
            for (const test of spec.tests) {
              const titlePath = [...specParents, test.title].join(" > ");
              if (test.results && test.results.length > 0) {
                for (const result of test.results) {
                  callback({
                    titlePath,
                    status: result.status,
                    errorMessage: result.error?.message ?? test.err?.message,
                  });
                }
              } else {
                callback({
                  titlePath,
                  status: test.state ?? "unknown",
                  errorMessage: test.err?.message,
                });
              }
            }
          }
        }
      }

      if (suite.suites) {
        this.iterateTestResults(suite.suites, callback, currentParents);
      }
    }
  }

  private generateReport(): StabilityReport {
    const successRates = this.results.map((r) => r.successRate);
    const durations = this.results.map((r) => r.duration);

    const averageSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
    const minSuccessRate = Math.min(...successRates);
    const maxSuccessRate = Math.max(...successRates);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Calculate stability score (0-100)
    const consistencyScore = 1 - (maxSuccessRate - minSuccessRate); // Lower variance = higher score
    const successScore = Math.min(averageSuccessRate / this.options.threshold, 1); // Success rate vs threshold
    const stabilityScore = (consistencyScore * 0.6 + successScore * 0.4) * 100;

    // Identify flaky tests (failed in some runs but not all)
    const testFailureCounts = new Map<string, number>();
    for (const result of this.results) {
      for (const failedTest of result.failedTests) {
        testFailureCounts.set(failedTest, (testFailureCounts.get(failedTest) || 0) + 1);
      }
    }

    const flakyTests = Array.from(testFailureCounts.entries())
      .filter(([, count]) => count > 0 && count < this.results.length)
      .map(([test]) => test);

    const recommendations: string[] = [];

    if (averageSuccessRate < this.options.threshold) {
      recommendations.push(
        `❌ Success rate ${(averageSuccessRate * 100).toFixed(1)}% below threshold ${(this.options.threshold * 100).toFixed(1)}%`
      );
    }

    if (stabilityScore < 80) {
      recommendations.push(
        `⚠️  Stability score ${stabilityScore.toFixed(1)} indicates inconsistent results`
      );
    }

    if (flakyTests.length > 0) {
      recommendations.push(
        `🔄 ${flakyTests.length} flaky tests detected: ${flakyTests.slice(0, 3).join(", ")}${flakyTests.length > 3 ? "..." : ""}`
      );
    }

    if (averageDuration > 300000) {
      // 5 minutes
      recommendations.push(
        `⏱️  Average test duration ${Math.round(averageDuration / 1000)}s is too slow`
      );
    }

    return {
      summary: {
        totalRuns: this.results.length,
        averageSuccessRate,
        minSuccessRate,
        maxSuccessRate,
        averageDuration,
        stabilityScore,
        flakyTests,
      },
      runs: this.results,
      recommendations,
    };
  }

  private saveReport(report: StabilityReport): void {
    const outputPath = join(__dirname, "..", this.options.output);
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${outputPath}`);
  }

  private printSummary(report: StabilityReport): void {
    console.log("📊 Stability Monitoring Summary");
    console.log("=================================");
    console.log(`Total runs: ${report.summary.totalRuns}`);
    console.log(`Average success rate: ${(report.summary.averageSuccessRate * 100).toFixed(1)}%`);
    console.log(
      `Success rate range: ${(report.summary.minSuccessRate * 100).toFixed(1)}% - ${(report.summary.maxSuccessRate * 100).toFixed(1)}%`
    );
    console.log(`Average duration: ${Math.round(report.summary.averageDuration / 1000)}s`);
    console.log(`Stability score: ${report.summary.stabilityScore.toFixed(1)}/100`);
    console.log(`Flaky tests: ${report.summary.flakyTests.length}`);

    if (report.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      report.recommendations.forEach((rec) => console.log(`  ${rec}`));
    }

    const status =
      report.summary.averageSuccessRate >= this.options.threshold &&
      report.summary.stabilityScore >= 80
        ? "✅ PASSED"
        : "❌ FAILED";
    console.log(`\n🏁 Overall status: ${status}`);
  }
}

// Run the monitor
new StabilityMonitor().run().catch(console.error);
