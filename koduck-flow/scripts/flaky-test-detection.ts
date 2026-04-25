#!/usr/bin/env node

/**
 * Flaky Test Detection Script
 *
 * Analyzes test results to identify flaky tests that fail intermittently.
 * Provides recommendations for stabilizing or quarantining flaky tests.
 *
 * Usage:
 *   node scripts/flaky-test-detection.ts [options]
 *
 * Options:
 *   --input file      Input stability report file (default: "stability-report.json")
 *   --output file     Output analysis file (default: "flaky-analysis.json")
 *   --threshold rate  Minimum failure rate to consider flaky (default: 0.1)
 *   --min-runs num    Minimum test runs to analyze (default: 5)
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    stabilityScore: number;
    flakyTests: string[];
  };
  runs: TestResult[];
  recommendations: string[];
}

interface FlakyTestAnalysis {
  testName: string;
  failureRate: number;
  totalRuns: number;
  failedRuns: number;
  successRuns: number;
  failurePattern: string[];
  errorMessages: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendations: string[];
}

interface FlakyAnalysisReport {
  summary: {
    totalTests: number;
    flakyTests: number;
    highRiskTests: number;
    analysisTimestamp: string;
    inputFile: string;
  };
  flakyTests: FlakyTestAnalysis[];
  recommendations: string[];
}

class FlakyTestDetector {
  private options: {
    input: string;
    output: string;
    threshold: number;
    minRuns: number;
  };

  constructor() {
    this.options = {
      input:
        process.argv.find((arg, i) => arg === "--input" && process.argv[i + 1]) ||
        "stability-report.json",
      output:
        process.argv.find((arg, i) => arg === "--output" && process.argv[i + 1]) ||
        "flaky-analysis.json",
      threshold: parseFloat(
        process.argv.find((arg, i) => arg === "--threshold" && process.argv[i + 1]) || "0.1"
      ),
      minRuns: parseInt(
        process.argv.find((arg, i) => arg === "--min-runs" && process.argv[i + 1]) || "5"
      ),
    };
  }

  async run(): Promise<void> {
    console.log("🔍 Starting Flaky Test Detection");
    console.log(`📊 Input: ${this.options.input}`);
    console.log(`🎯 Flaky threshold: ${(this.options.threshold * 100).toFixed(1)}%`);
    console.log(`📈 Minimum runs: ${this.options.minRuns}`);
    console.log("");

    const stabilityReport = this.loadStabilityReport();
    const analysis = this.analyzeFlakyTests(stabilityReport);
    this.saveAnalysis(analysis);
    this.printSummary(analysis);
  }

  private loadStabilityReport(): StabilityReport {
    const inputPath = join(__dirname, "..", this.options.input);
    try {
      const data = readFileSync(inputPath, "utf-8");
      return JSON.parse(data) as StabilityReport;
    } catch (error) {
      console.error(`❌ Failed to load stability report from ${inputPath}:`, error);
      process.exit(1);
    }
  }

  private analyzeFlakyTests(report: StabilityReport): FlakyAnalysisReport {
    const testFailureMap = new Map<
      string,
      { failures: number; total: number; patterns: string[]; errors: Set<string> }
    >();

    // Aggregate failure data for each test
    for (const run of report.runs) {
      for (const failedTest of run.failedTests) {
        if (!testFailureMap.has(failedTest)) {
          testFailureMap.set(failedTest, {
            failures: 0,
            total: 0,
            patterns: [],
            errors: new Set(),
          });
        }
        const testData = testFailureMap.get(failedTest)!;
        testData.failures++;
        testData.patterns.push(run.runId.toString());
      }

      // Count total runs for each test that appeared
      for (const failedTest of run.failedTests) {
        testFailureMap.get(failedTest)!.total = report.runs.length;
      }
    }

    // Also count tests that never failed (from successful runs)
    // In a real implementation, we'd need to parse the full test results
    // const allTestNames = new Set<string>();
    // for (const run of report.runs) {
    //   // Implementation would go here
    // }

    // Analyze flaky tests
    const flakyTests: FlakyTestAnalysis[] = [];

    for (const [testName, data] of testFailureMap) {
      if (data.total < this.options.minRuns) {
        continue; // Not enough data
      }

      const failureRate = data.failures / data.total;

      if (failureRate >= this.options.threshold && failureRate < 1.0) {
        // This is a flaky test
        const analysis: FlakyTestAnalysis = {
          testName,
          failureRate,
          totalRuns: data.total,
          failedRuns: data.failures,
          successRuns: data.total - data.failures,
          failurePattern: data.patterns,
          errorMessages: Array.from(data.errors),
          riskLevel: this.calculateRiskLevel(failureRate, data.failures),
          recommendations: this.generateRecommendations(testName, failureRate, data),
        };

        flakyTests.push(analysis);
      }
    }

    // Sort by failure rate descending
    flakyTests.sort((a, b) => b.failureRate - a.failureRate);

    const recommendations: string[] = [];

    if (flakyTests.length === 0) {
      recommendations.push("✅ No flaky tests detected above threshold");
    } else {
      recommendations.push(`⚠️ ${flakyTests.length} flaky tests identified`);
      const highRisk = flakyTests.filter(
        (t) => t.riskLevel === "high" || t.riskLevel === "critical"
      );
      if (highRisk.length > 0) {
        recommendations.push(
          `🚨 ${highRisk.length} high-risk flaky tests require immediate attention`
        );
      }
    }

    return {
      summary: {
        totalTests: testFailureMap.size,
        flakyTests: flakyTests.length,
        highRiskTests: flakyTests.filter(
          (t) => t.riskLevel === "high" || t.riskLevel === "critical"
        ).length,
        analysisTimestamp: new Date().toISOString(),
        inputFile: this.options.input,
      },
      flakyTests,
      recommendations,
    };
  }

  private calculateRiskLevel(
    failureRate: number,
    failureCount: number
  ): "low" | "medium" | "high" | "critical" {
    if (failureRate >= 0.5 || failureCount >= 10) {
      return "critical";
    } else if (failureRate >= 0.3 || failureCount >= 5) {
      return "high";
    } else if (failureRate >= 0.2 || failureCount >= 3) {
      return "medium";
    } else {
      return "low";
    }
  }

  private generateRecommendations(
    testName: string,
    failureRate: number,
    data: { patterns: string[] }
  ): string[] {
    const recommendations: string[] = [];

    if (failureRate >= 0.5) {
      recommendations.push("🚨 Quarantine this test immediately - failure rate too high");
    } else if (failureRate >= 0.3) {
      recommendations.push("⚠️ Investigate root cause and fix within 1 sprint");
    } else {
      recommendations.push("🔍 Monitor and investigate intermittent failures");
    }

    if (data.patterns.length > 0) {
      const pattern = data.patterns.join(", ");
      recommendations.push(`📊 Failure pattern: runs ${pattern}`);
    }

    recommendations.push("💡 Check for race conditions, timing issues, or external dependencies");
    recommendations.push("🔧 Consider adding retry logic or stabilizing test setup");

    return recommendations;
  }

  private saveAnalysis(analysis: FlakyAnalysisReport): void {
    const outputPath = join(__dirname, "..", this.options.output);
    writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    console.log(`📄 Analysis saved to: ${outputPath}`);
  }

  private printSummary(analysis: FlakyAnalysisReport): void {
    console.log("📊 Flaky Test Analysis Summary");
    console.log("==============================");
    console.log(`Total tests analyzed: ${analysis.summary.totalTests}`);
    console.log(`Flaky tests found: ${analysis.summary.flakyTests}`);
    console.log(`High-risk flaky tests: ${analysis.summary.highRiskTests}`);
    console.log(`Analysis timestamp: ${analysis.summary.analysisTimestamp}`);
    console.log("");

    if (analysis.flakyTests.length > 0) {
      console.log("🔥 Top Flaky Tests:");
      analysis.flakyTests.slice(0, 5).forEach((test, index) => {
        console.log(`${index + 1}. ${test.testName}`);
        console.log(`   Failure rate: ${(test.failureRate * 100).toFixed(1)}%`);
        console.log(`   Risk level: ${test.riskLevel.toUpperCase()}`);
        console.log(`   Failed runs: ${test.failedRuns}/${test.totalRuns}`);
        console.log("");
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log("💡 Recommendations:");
      analysis.recommendations.forEach((rec) => console.log(`  ${rec}`));
    }

    const status = analysis.summary.flakyTests === 0 ? "✅ PASSED" : "❌ ISSUES FOUND";
    console.log(`\n🏁 Overall status: ${status}`);
  }
}

// Run the detector
new FlakyTestDetector().run().catch(console.error);
