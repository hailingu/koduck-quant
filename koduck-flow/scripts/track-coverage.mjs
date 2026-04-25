#!/usr/bin/env node

/**
 * Coverage Tracking and Trending Script
 *
 * Automatically tracks coverage metrics over time, stores historical data,
 * and generates trend analysis reports showing coverage changes and patterns.
 *
 * Usage:
 *   npm run coverage:track
 *   node scripts/track-coverage.mjs [--baseline] [--report]
 *
 * Flags:
 *   --baseline: Create baseline snapshot (used on first run)
 *   --report: Generate trend analysis report after tracking
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Configuration
const COVERAGE_FILE = "./coverage/coverage-final.json";
const HISTORY_DIR = "./.coverage-history";
const METADATA_FILE = path.join(HISTORY_DIR, "metadata.json");
const REPORT_DIR = "./coverage/reports";

// Ensure directories exist
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
};

// Get git metadata
const getGitMetadata = () => {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    const commit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    const shortCommit = commit.substring(0, 7);
    const author = execSync("git log -1 --format=%an", { encoding: "utf-8" }).trim();
    const message = execSync("git log -1 --format=%s", { encoding: "utf-8" }).trim();
    const timestamp = execSync("git log -1 --format=%aI", { encoding: "utf-8" }).trim();

    return { branch, commit, shortCommit, author, message, timestamp };
  } catch (error) {
    console.warn("⚠ Could not retrieve git metadata:", error.message);
    return {
      branch: "unknown",
      commit: "unknown",
      shortCommit: "unknown",
      author: "unknown",
      message: "unknown",
      timestamp: new Date().toISOString(),
    };
  }
};

// Parse coverage data from coverage-final.json
const parseCoverageData = () => {
  if (!fs.existsSync(COVERAGE_FILE)) {
    throw new Error(
      `Coverage file not found: ${COVERAGE_FILE}. Run 'npm run test:coverage' first.`
    );
  }

  const coverageJson = JSON.parse(fs.readFileSync(COVERAGE_FILE, "utf-8"));

  // Calculate aggregate metrics
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;
  let fileCount = 0;

  for (const fileCoverage of Object.values(coverageJson)) {
    fileCount++;

    // Statements
    if (fileCoverage.s) {
      const stmts = Object.values(fileCoverage.s);
      totalStatements += stmts.length;
      coveredStatements += stmts.filter((count) => count > 0).length;
    }

    // Branches
    if (fileCoverage.b) {
      const branches = Object.values(fileCoverage.b).flat();
      totalBranches += branches.length;
      coveredBranches += branches.filter((count) => count > 0).length;
    }

    // Functions
    if (fileCoverage.f) {
      const funcs = Object.values(fileCoverage.f);
      totalFunctions += funcs.length;
      coveredFunctions += funcs.filter((count) => count > 0).length;
    }

    // Lines
    if (fileCoverage.statementMap) {
      const lines = Object.keys(fileCoverage.statementMap);
      totalLines += lines.length;
      const lineCounts = Object.values(fileCoverage.s || {});
      coveredLines += lineCounts.filter((count) => count > 0).length;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    fileCount,
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      percentage:
        totalStatements > 0 ? ((coveredStatements / totalStatements) * 100).toFixed(2) : 0,
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      percentage: totalBranches > 0 ? ((coveredBranches / totalBranches) * 100).toFixed(2) : 0,
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      percentage: totalFunctions > 0 ? ((coveredFunctions / totalFunctions) * 100).toFixed(2) : 0,
    },
    lines: {
      total: totalLines,
      covered: coveredLines,
      percentage: totalLines > 0 ? ((coveredLines / totalLines) * 100).toFixed(2) : 0,
    },
  };
};

// Create snapshot file
const createSnapshot = (coverageData, gitMetadata) => {
  const timestamp = new Date();
  const filename = `coverage-${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}-${String(timestamp.getHours()).padStart(2, "0")}-${String(timestamp.getMinutes()).padStart(2, "0")}-${String(timestamp.getSeconds()).padStart(2, "0")}.json`;

  const snapshot = {
    ...coverageData,
    git: gitMetadata,
  };

  const filePath = path.join(HISTORY_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

  return { filename, snapshot, filePath };
};

// Update metadata file
const updateMetadata = (snapshot) => {
  let metadata = {
    snapshots: [],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  if (fs.existsSync(METADATA_FILE)) {
    metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
  }

  metadata.lastUpdated = new Date().toISOString();
  metadata.snapshots.push({
    filename: snapshot.filename,
    timestamp: snapshot.snapshot.timestamp,
    branch: snapshot.snapshot.git.branch,
    commit: snapshot.snapshot.git.shortCommit,
    author: snapshot.snapshot.git.author,
    message: snapshot.snapshot.git.message,
    coverage: {
      statements: Number.parseFloat(snapshot.snapshot.statements.percentage),
      branches: Number.parseFloat(snapshot.snapshot.branches.percentage),
      functions: Number.parseFloat(snapshot.snapshot.functions.percentage),
      lines: Number.parseFloat(snapshot.snapshot.lines.percentage),
    },
  });

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  return metadata;
};

// Calculate trend (compared to previous snapshot)
const calculateTrend = (metadata) => {
  if (metadata.snapshots.length < 2) {
    return null;
  }

  const current = metadata.snapshots[metadata.snapshots.length - 1].coverage;
  const previous = metadata.snapshots[metadata.snapshots.length - 2].coverage;

  return {
    statements: Number.parseFloat((current.statements - previous.statements).toFixed(2)),
    branches: Number.parseFloat((current.branches - previous.branches).toFixed(2)),
    functions: Number.parseFloat((current.functions - previous.functions).toFixed(2)),
    lines: Number.parseFloat((current.lines - previous.lines).toFixed(2)),
  };
};

// Format trend emoji and percentage
const formatTrend = (value) => {
  if (value > 0) return { emoji: "📈", sign: "+" };
  if (value < 0) return { emoji: "📉", sign: "" };
  return { emoji: "➡️", sign: "" };
};

// Format trend status
const formatStatus = (value) => {
  if (value > 0) return "🟢 Better";
  if (value < 0) return "🔴 Worse";
  return "⚪ Same";
};

// Format threshold indicator
const formatThreshold = (value, threshold = 80) => (value >= threshold ? "✅" : "❌");

// Generate current coverage table
const generateCoverageTable = (current) => {
  let table = `| Metric | Coverage | Status |\n`;
  table += `|--------|----------|--------|\n`;
  table += `| Statements | ${current.coverage.statements.toFixed(2)}% | ${formatThreshold(current.coverage.statements)} |\n`;
  table += `| Branches | ${current.coverage.branches.toFixed(2)}% | ${formatThreshold(current.coverage.branches)} |\n`;
  table += `| Functions | ${current.coverage.functions.toFixed(2)}% | ${formatThreshold(current.coverage.functions)} |\n`;
  table += `| Lines | ${current.coverage.lines.toFixed(2)}% | ${formatThreshold(current.coverage.lines)} |\n\n`;
  return table;
};

// Generate trend comparison table
const generateTrendTable = (current, previous, trend) => {
  const formatTrendRow = (metric, prev, curr, trendVal) => {
    const { emoji, sign } = formatTrend(trendVal);
    const status = formatStatus(trendVal);
    return `| ${metric} | ${prev.toFixed(2)}% | ${curr.toFixed(2)}% | ${emoji} ${sign}${Math.abs(trendVal).toFixed(2)}% | ${status} |\n`;
  };

  let table = `| Metric | Previous | Current | Change | Status |\n`;
  table += `|--------|----------|---------|--------|--------|\n`;
  table += formatTrendRow(
    "Statements",
    previous.coverage.statements,
    current.coverage.statements,
    trend.statements
  );
  table += formatTrendRow(
    "Branches",
    previous.coverage.branches,
    current.coverage.branches,
    trend.branches
  );
  table += formatTrendRow(
    "Functions",
    previous.coverage.functions,
    current.coverage.functions,
    trend.functions
  );
  table += formatTrendRow("Lines", previous.coverage.lines, current.coverage.lines, trend.lines);
  table += "\n";
  return table;
};

// Generate history table
const generateHistoryTable = (metadata) => {
  let table = `| # | Timestamp | Statements | Branches | Functions | Lines | Branch |\n`;
  table += `|---|-----------|------------|----------|-----------|-------|--------|\n`;

  const recent = metadata.snapshots.slice(-10).reverse();
  for (const [idx, snap] of recent.entries()) {
    const num = metadata.snapshots.length - idx;
    const timestamp = snap.timestamp.split("T");
    const time = `${timestamp[0]} ${timestamp[1].substring(0, 5)}`;
    table += `| ${num} | ${time} | ${snap.coverage.statements.toFixed(2)}% | ${snap.coverage.branches.toFixed(2)}% | ${snap.coverage.functions.toFixed(2)}% | ${snap.coverage.lines.toFixed(2)}% | ${snap.branch} |\n`;
  }

  return table;
};

// Generate trend analysis report
const generateReport = (metadata) => {
  ensureDirExists(REPORT_DIR);

  const reportFilename = `coverage-trend-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}.md`;
  const reportPath = path.join(REPORT_DIR, reportFilename);

  const trend = calculateTrend(metadata);
  const current = metadata.snapshots[metadata.snapshots.length - 1];
  const previous = metadata.snapshots[metadata.snapshots.length - 2];

  let report = `# Coverage Trend Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  report += `## Current Coverage (Latest Snapshot)\n\n`;
  report += generateCoverageTable(current);

  if (trend) {
    report += `## Trend Analysis (vs Previous Snapshot)\n\n`;
    report += generateTrendTable(current, previous, trend);
  }

  report += `## Git Context\n\n`;
  report += `| Property | Value |\n`;
  report += `|----------|-------|\n`;
  report += `| Branch | ${current.branch} |\n`;
  report += `| Commit | ${current.commit} |\n`;
  report += `| Author | ${current.author} |\n`;
  report += `| Message | ${current.message} |\n\n`;

  report += `## History\n\n`;
  report += `Recent snapshots (last 10):\n\n`;
  report += generateHistoryTable(metadata);

  report += `## Thresholds\n\n`;
  report += `Target coverage thresholds:\n`;
  report += `- Statements: 85%\n`;
  report += `- Branches: 80%\n`;
  report += `- Functions: 80%\n`;
  report += `- Lines: 85%\n\n`;

  report += `## Total Snapshots Tracked\n\n`;
  report += `${metadata.snapshots.length} snapshots recorded since tracking started.\n`;

  fs.writeFileSync(reportPath, report);
  return reportPath;
};

// Print coverage metrics
const printMetrics = (coverageData, snapshot) => {
  console.log("\n📊 Coverage Metrics Snapshot:\n");
  console.log(
    `  Statements: ${coverageData.statements.percentage}% (${coverageData.statements.covered}/${coverageData.statements.total})`
  );
  console.log(
    `  Branches:   ${coverageData.branches.percentage}% (${coverageData.branches.covered}/${coverageData.branches.total})`
  );
  console.log(
    `  Functions:  ${coverageData.functions.percentage}% (${coverageData.functions.covered}/${coverageData.functions.total})`
  );
  console.log(
    `  Lines:      ${coverageData.lines.percentage}% (${coverageData.lines.covered}/${coverageData.lines.total})`
  );
  console.log(`  Files:      ${coverageData.fileCount}\n`);
  console.log(`  📁 Saved to: ${snapshot.filePath}`);
};

// Format trend output
const formatTrendOutput = (metric, value) => {
  const { emoji, sign } = formatTrend(value);
  return `${metric.padEnd(12)} ${emoji} ${sign}${Math.abs(value).toFixed(2)}%`;
};

// Main execution
const main = async () => {
  console.log("🔍 Coverage Tracking Script\n");
  console.log("═".repeat(50));

  const args = new Set(process.argv.slice(2));
  const shouldReport = args.has("--report");

  try {
    // Ensure directories exist
    ensureDirExists(HISTORY_DIR);
    ensureDirExists(REPORT_DIR);

    // Parse coverage data
    console.log("\n📈 Parsing coverage data...");
    const coverageData = parseCoverageData();

    // Get git metadata
    console.log("🔗 Retrieving git metadata...");
    const gitMetadata = getGitMetadata();

    // Create snapshot
    console.log("💾 Creating snapshot...");
    const snapshot = createSnapshot(coverageData, gitMetadata);

    // Update metadata
    console.log("📝 Updating metadata...");
    const metadata = updateMetadata(snapshot);

    // Print metrics
    printMetrics(coverageData, snapshot);

    // Calculate and print trend
    const trend = calculateTrend(metadata);
    if (trend) {
      console.log("\n📉 Trend Analysis (vs Previous Snapshot):\n");
      console.log(`  ${formatTrendOutput("Statements:", trend.statements)}`);
      console.log(`  ${formatTrendOutput("Branches:", trend.branches)}`);
      console.log(`  ${formatTrendOutput("Functions:", trend.functions)}`);
      console.log(`  ${formatTrendOutput("Lines:", trend.lines)}\n`);
    }

    // Generate report if requested or every 5 snapshots
    if (shouldReport || metadata.snapshots.length % 5 === 0) {
      console.log("📄 Generating trend analysis report...");
      const reportPath = generateReport(metadata);
      console.log(`  ✓ Report saved to: ${reportPath}\n`);
    }

    console.log("═".repeat(50));
    console.log(`✅ Coverage tracking completed successfully!\n`);
    console.log(`📊 Total snapshots: ${metadata.snapshots.length}`);
    console.log(`📁 History: ${HISTORY_DIR}/`);
    console.log(`📄 Metadata: ${METADATA_FILE}\n`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
};

main();
