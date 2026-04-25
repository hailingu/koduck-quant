#!/usr/bin/env node
/*
 * Flaky detector: runs a specific test file multiple times and record failures.
 * - Usage: node scripts/flaky-detector.js --target test/unit/di/scope-manager.test.ts --runs 10
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      result[key] = value;
      i++;
    }
  }
  return result;
}

function runTest(target) {
  const r = spawnSync("pnpm", ["test", target, "--silent"], { encoding: "utf8" });
  return r.status === 0;
}

function detector(target, runs) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    console.log(`Run ${i + 1}/${runs}`);
    const ok = runTest(target);
    results.push(ok);
  }
  return results;
}

function saveReport(target, runs, out) {
  const res = detector(target, runs);
  const stats = {
    target,
    runs,
    passed: res.filter(Boolean).length,
    failed: res.filter((x) => !x).length,
    flakyRate: ((res.filter((x) => !x).length / runs) * 100).toFixed(2) + "%",
    results: res,
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(stats, null, 2));
  console.log("Saved flaky report to", out);
}

// Main execution
const argv = parseArgs(process.argv.slice(2));
const target = argv.target || argv.t;
const runs = Number.parseInt(argv.runs || argv.r || 10, 10);
const out = argv.out || `reports/flaky-${path.basename(target)}-${Date.now()}.json`;
if (!target) {
  console.error("Usage: --target <testfile> --runs <n>");
  process.exit(2);
}
saveReport(target, runs, out);
