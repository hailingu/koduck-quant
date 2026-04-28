#!/usr/bin/env node
/*
 * Simple audit script for tests and coverage.
 * - Lists tests using vitest
 * - Collects basic test file metadata
 * - Outputs a JSON report
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findTestFiles() {
  // Find all test files in test/ directory
  const testDir = path.join(process.cwd(), "test");
  const result = [];

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith(".test.ts") || file.endsWith(".test.js")) {
        result.push(path.relative(process.cwd(), fullPath));
      }
    }
  }

  walk(testDir);
  return result;
}

function getCoverageStats() {
  // Read coverage data from coverage-final.json if available
  const coveragePath = path.join(process.cwd(), "coverage", "coverage-final.json");
  if (fs.existsSync(coveragePath)) {
    const data = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
    // Calculate summary
    let totalStatements = 0;
    let coveredStatements = 0;

    for (const file in data) {
      const fileCov = data[file];
      if (fileCov.s) {
        totalStatements += Object.keys(fileCov.s).length;
        coveredStatements += Object.values(fileCov.s).filter((v) => v > 0).length;
      }
    }

    return {
      totalStatements,
      coveredStatements,
      coveragePercent:
        totalStatements > 0 ? ((coveredStatements / totalStatements) * 100).toFixed(2) : 0,
      filesWithCoverage: Object.keys(data).length,
    };
  }

  return { note: "Run 'pnpm run test:coverage' to generate coverage data" };
}

function saveReport(outFile) {
  console.log("Scanning test files...");
  const tests = findTestFiles();
  console.log(`Found ${tests.length} test files`);

  const coverage = getCoverageStats();
  const report = {
    generatedAt: new Date().toISOString(),
    testCount: tests.length,
    tests,
    coverageSummary: coverage,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log("Written:", outFile);
}

// Main execution
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : "reports/test-audit.json";
saveReport(outFile);
