#!/usr/bin/env node

/**
 * E2E Report Summary Generator
 *
 * Generates summary from Playwright JSON report and outputs to GitHub Step Summary.
 * Usage: tsx generate-e2e-report-summary.ts --report-path <path> --report-url <url>
 *
 * Environment:
 *   GITHUB_STEP_SUMMARY - Path to the step summary file (auto-set in GitHub Actions)
 *   GITHUB_ACTIONS - Set to true when running in GitHub Actions
 */

import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { argv } from "node:process";

interface PlaywrightReport {
  config?: { use?: { baseURL?: string } };
  suites?: Array<{
    title: string;
    tests?: Array<{
      title: string;
      status: "passed" | "failed" | "skipped" | "timedOut";
      duration?: number;
      error?: { message: string };
    }>;
  }>;
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
    duration?: number;
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function generateReportSummary(report: PlaywrightReport, reportUrl?: string): string {
  const stats = report.stats || { expected: 0, unexpected: 0, flaky: 0, skipped: 0, duration: 0 };
  const totalTests = (stats.expected || 0) + (stats.unexpected || 0) + (stats.flaky || 0);
  const passedTests = stats.expected || 0;
  const failedTests = (stats.unexpected || 0) + (stats.flaky || 0);
  const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : "0.00";

  let summary = `## 📊 Playwright E2E Report Summary\n\n`;

  // Report stats
  summary += `### Test Results\n`;
  summary += `- ✅ **Passed**: ${passedTests}\n`;
  summary += `- ❌ **Failed**: ${failedTests}\n`;
  summary += `- ⏭️ **Skipped**: ${stats.skipped || 0}\n`;
  summary += `- 🔄 **Flaky**: ${stats.flaky || 0}\n`;
  summary += `- 🎯 **Total**: ${totalTests}\n`;
  summary += `- 📈 **Success Rate**: ${successRate}%\n`;
  summary += `- ⏱️ **Duration**: ${formatDuration(stats.duration || 0)}\n\n`;

  // Test suites breakdown
  if (report.suites && report.suites.length > 0) {
    summary += `### Test Suites\n`;
    for (const suite of report.suites) {
      if (suite.tests && suite.tests.length > 0) {
        const suitePassed = suite.tests.filter((t) => t.status === "passed").length;
        const suiteFailed = suite.tests.length - suitePassed;
        const suiteRate = ((suitePassed / suite.tests.length) * 100).toFixed(0);
        const badge = suiteFailed > 0 ? "🟠" : "🟢";
        summary += `- ${badge} **${suite.title}**: ${suitePassed}/${suite.tests.length} (${suiteRate}%)\n`;
      }
    }
    summary += "\n";
  }

  // Report links
  if (reportUrl) {
    summary += `### 📋 Report Links\n`;
    summary += `- [🌐 View Full Report](${reportUrl})\n`;
    summary += `- [📥 Download HTML Report](${reportUrl}/index.html)\n\n`;
  }

  // Quick action
  summary += `### 🔍 How to View Locally\n`;
  summary += `\`\`\`bash\n`;
  summary += `# After downloading the artifact:\n`;
  summary += `npx playwright show-report ./path/to/playwright-report\n`;
  summary += `\`\`\`\n\n`;

  // Threshold status
  const thresholdPass = Number.parseFloat(successRate) >= 70;
  summary += `### ✓ Coverage Threshold\n`;
  summary += `- **Target**: ≥70% success rate\n`;
  summary += `- **Current**: ${successRate}%\n`;
  summary += `- **Status**: ${thresholdPass ? "✅ PASS" : "❌ FAIL"}\n`;

  return summary;
}

function main() {
  const args = parseArgs(argv.slice(2));
  const reportPath = args["report-path"];
  const reportUrl = args["report-url"] || process.env.PLAYWRIGHT_REPORT_URL;

  if (!reportPath) {
    console.error("Error: --report-path is required");
    process.exit(1);
  }

  if (!existsSync(reportPath)) {
    console.warn(`Warning: Report file not found at ${reportPath}`);
    console.warn("This is normal if tests were skipped or not run.");
    return;
  }

  try {
    const reportContent = readFileSync(reportPath, "utf-8");
    const report = JSON.parse(reportContent) as PlaywrightReport;
    const summary = generateReportSummary(report, reportUrl);

    // Output to console
    console.log(summary);

    // Append to GitHub Step Summary if available
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      appendFileSync(summaryPath, summary);
      console.log(`\n✅ Report summary appended to ${summaryPath}`);
    }
  } catch (error) {
    console.error(
      `Error processing report: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateReportSummary };
