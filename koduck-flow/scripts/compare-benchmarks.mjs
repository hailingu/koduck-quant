#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TOLERANCE_PERCENT = 5; // 5% tolerance for performance regressions
const BASELINE_PATH = resolve(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "benchmarks/baseline.json"
);
const REPORT_PATH = resolve(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "benchmarks/report.json"
);
const COMPARISON_PATH = resolve(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "benchmarks/last-comparison.json"
);

function calculateDiffPercent(baseline, current) {
  return ((current - baseline) / baseline) * 100;
}

function isWithinTolerance(diffPercent, tolerance) {
  return Math.abs(diffPercent) <= tolerance;
}

async function loadBaseline() {
  try {
    const content = await readFile(BASELINE_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load baseline from ${BASELINE_PATH}: ${error}`);
  }
}

async function loadReport() {
  try {
    const content = await readFile(REPORT_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load report from ${REPORT_PATH}: ${error}`);
  }
}

function compareResults(baseline, report, tolerance) {
  const baselineMap = new Map(baseline.results.map((r) => [r.scenario, r]));
  const reportMap = new Map(report.results.map((r) => [r.scenario, r]));

  const results = [];
  let totalBaseline = 0;
  let totalReport = 0;

  for (const [scenario, baselineResult] of baselineMap) {
    const reportResult = reportMap.get(scenario);
    if (!reportResult) {
      throw new Error(`Scenario '${scenario}' missing from current report`);
    }

    const diffPercent = calculateDiffPercent(
      baselineResult.totalDurationMs,
      reportResult.totalDurationMs
    );
    const status = isWithinTolerance(diffPercent, tolerance)
      ? "within_tolerance"
      : "out_of_tolerance";

    results.push({
      scenario,
      baselineTotalMs: baselineResult.totalDurationMs,
      reportTotalMs: reportResult.totalDurationMs,
      diffPercent,
      status,
    });

    totalBaseline += baselineResult.totalDurationMs;
    totalReport += reportResult.totalDurationMs;
  }

  const totalDiffPercent = calculateDiffPercent(totalBaseline, totalReport);

  return {
    baselineGeneratedAt: baseline.generatedAt,
    reportGeneratedAt: report.generatedAt,
    tolerance,
    results,
    totalDiffPercent,
  };
}

function printComparison(comparison) {
  console.log("\n📊 Benchmark Regression Analysis");
  console.log("─────────────────────────────────");
  console.log(`Baseline: ${new Date(comparison.baselineGeneratedAt).toLocaleString()}`);
  console.log(`Current:  ${new Date(comparison.reportGeneratedAt).toLocaleString()}`);
  console.log(`Tolerance: ±${comparison.tolerance}%`);

  for (const result of comparison.results) {
    const status = result.status === "within_tolerance" ? "✅" : "❌";
    const sign = result.diffPercent >= 0 ? "+" : "";
    console.log(
      `${status} ${result.scenario}: ${sign}${result.diffPercent.toFixed(2)}% (${result.reportTotalMs.toFixed(2)}ms vs ${result.baselineTotalMs.toFixed(2)}ms)`
    );
  }

  const totalSign = comparison.totalDiffPercent >= 0 ? "+" : "";
  console.log(`\n📈 Total change: ${totalSign}${comparison.totalDiffPercent.toFixed(2)}%`);
}

function parseArgs(argv) {
  const args = { updateBaseline: false };
  for (const arg of argv) {
    if (arg === "--update-baseline") {
      args.updateBaseline = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    console.log("🔍 Loading benchmark data...");

    const [baseline, report] = await Promise.all([loadBaseline(), loadReport()]);

    if (args.updateBaseline) {
      console.log("🧭 Updating baseline...");
      await writeFile(BASELINE_PATH, JSON.stringify(report, null, 2), "utf-8");
      console.log(`✅ Baseline updated from current report at ${BASELINE_PATH}`);
      return;
    }

    console.log("⚖️  Comparing against baseline...");

    const comparison = compareResults(baseline, report, TOLERANCE_PERCENT);

    printComparison(comparison);

    await writeFile(COMPARISON_PATH, JSON.stringify(comparison, null, 2), "utf-8");
    console.log(`\n💾 Comparison saved to ${COMPARISON_PATH}`);

    const hasRegressions = comparison.results.some(
      (r) => r.status === "out_of_tolerance" && r.diffPercent > 0
    );

    if (hasRegressions) {
      console.log("\n❌ Performance regression detected! Failing CI.");
      process.exit(1);
    } else {
      console.log("\n✅ All benchmarks within tolerance. CI passes.");
    }
  } catch (error) {
    console.error("❌ Benchmark comparison failed:", error);
    process.exit(1);
  }
}

void main();
