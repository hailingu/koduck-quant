#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read JSON from ${filePath}: ${error.message}`);
  }
}

function parseBytes(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`Unsupported size value: ${value}`);
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(b|kb|mb)?$/i);
  if (!match) {
    throw new Error(`Invalid size format '${value}'. Supported examples: 512, 32kb, 1.5mb`);
  }
  const number = Number(match[1]);
  const unit = (match[2] || "b").toLowerCase();

  switch (unit) {
    case "b":
      return Math.round(number);
    case "kb":
      return Math.round(number * 1024);
    case "mb":
      return Math.round(number * 1024 * 1024);
    default:
      throw new Error(`Unsupported unit '${unit}' in value '${value}'.`);
  }
}

function formatBytes(bytes) {
  if (bytes == null) return "n/a";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function walkFiles(dir, relativeBase = dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, relativeBase));
    } else {
      const relPath = path.relative(relativeBase, fullPath).split(path.sep).join("/");
      files.push({ fullPath, relativePath: relPath });
    }
  }
  return files;
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__GLOBSTAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__GLOBSTAR__/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function matchFiles(files, patterns) {
  const regexes = patterns.map(globToRegExp);
  return files.filter((file) => regexes.some((regex) => regex.test(file.relativePath)));
}

function aggregate(values, mode = "max") {
  if (values.length === 0) return 0;
  if (mode === "sum") {
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (mode === "max") {
    return Math.max(...values);
  }
  throw new Error(`Unsupported aggregation mode '${mode}'. Use 'max' or 'sum'.`);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function parseArgs(argv) {
  const args = { updateBaseline: false, distDir: null };
  const positional = [];

  for (const arg of argv) {
    if (arg === "--update-baseline") {
      args.updateBaseline = true;
    } else if (arg.startsWith("--dist=")) {
      args.distDir = arg.slice("--dist=".length);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0 && !args.distDir) {
    args.distDir = positional[0];
  }

  return args;
}

function loadBaseline(baselinePath) {
  if (!baselinePath || !existsSync(baselinePath)) {
    return {};
  }
  try {
    return loadJson(baselinePath);
  } catch (error) {
    console.warn(`⚠️  Failed to parse existing baseline at ${baselinePath}: ${error.message}`);
    return {};
  }
}

function collectFileStats(matches) {
  return matches.map((match) => {
    const buffer = readFileSync(match.fullPath);
    return {
      path: match.relativePath,
      rawBytes: buffer.length,
      gzipBytes: gzipSync(buffer).length,
    };
  });
}

function evaluateBudget(budget, fileStats, baselineEntry) {
  const aggregation = budget.aggregation ?? "max";
  const rawBytes = aggregate(
    fileStats.map((file) => file.rawBytes),
    aggregation
  );
  const gzipBytes = aggregate(
    fileStats.map((file) => file.gzipBytes),
    aggregation
  );

  const rawLimit = parseBytes(budget.rawLimit ?? budget.limit ?? null);
  const gzipLimit = parseBytes(budget.gzipLimit ?? budget.gzip ?? null);

  const passesRaw = rawLimit == null || rawBytes <= rawLimit;
  const passesGzip = gzipLimit == null || gzipBytes <= gzipLimit;

  const rawBaseline = baselineEntry?.rawBytes ?? null;
  const gzipBaseline = baselineEntry?.gzipBytes ?? null;

  const rawDelta = rawBaseline == null ? null : rawBytes - rawBaseline;
  const gzipDelta = gzipBaseline == null ? null : gzipBytes - gzipBaseline;

  const warnings = [];
  if (rawLimit != null && rawBytes > rawLimit * 0.9 && rawBytes <= rawLimit) {
    warnings.push("raw-near-limit");
  }
  if (gzipLimit != null && gzipBytes > gzipLimit * 0.9 && gzipBytes <= gzipLimit) {
    warnings.push("gzip-near-limit");
  }

  let status = "pass";
  if (!passesRaw || !passesGzip) {
    status = "fail";
  } else if (warnings.length > 0) {
    status = "warn";
  }

  return {
    status,
    aggregation,
    rawBytes,
    gzipBytes,
    rawLimit,
    gzipLimit,
    rawBaseline,
    gzipBaseline,
    rawDelta,
    gzipDelta,
    warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const configPath = path.join(rootDir, "performance-budget.json");
  const config = loadJson(configPath);

  const distDir = path.resolve(rootDir, args.distDir ?? config.distDir ?? "dist-ci-bundle");
  const assetsDir = path.join(distDir, config.assetsDir ?? "");
  const reportPath = config.reportPath ? path.resolve(rootDir, config.reportPath) : null;
  const baselinePath = config.baselinePath ? path.resolve(rootDir, config.baselinePath) : null;

  const allFiles = walkFiles(assetsDir, assetsDir);
  const baseline = loadBaseline(baselinePath);

  const reportResults = [];
  let hasFailures = false;
  let hasMissingRequired = false;

  console.log("📦 Bundle Size Budget Check");
  console.log("────────────────────────");
  console.log(`Dist directory: ${distDir}`);
  console.log(`Assets scanned: ${allFiles.length}`);

  for (const budget of config.budgets ?? []) {
    const patterns = budget.patterns ?? [];
    if (patterns.length === 0) {
      console.warn(`⚠️  Budget '${budget.name}' has no patterns defined. Skipping.`);
      continue;
    }

    const matches = matchFiles(allFiles, patterns);
    if (matches.length === 0) {
      const message = `⚠️  No assets matched budget '${budget.name}' (${patterns.join(", ")}).`;
      if (budget.required ?? true) {
        console.error(message);
        hasMissingRequired = true;
      } else {
        console.warn(message);
      }
      reportResults.push({
        name: budget.name,
        description: budget.description ?? null,
        files: [],
        ...evaluateBudget(budget, [], baseline[budget.name]),
      });
      continue;
    }

    const fileStats = collectFileStats(matches);
    const evaluation = evaluateBudget(budget, fileStats, baseline[budget.name]);

    const icon = evaluation.status === "pass" ? "✅" : evaluation.status === "warn" ? "⚠️" : "❌";
    console.log(`\n${icon} ${budget.name}`);
    console.log(`   Files: ${fileStats.map((f) => f.path).join(", ")}`);
    console.log(
      `   Raw:  ${formatBytes(evaluation.rawBytes)}${evaluation.rawLimit ? ` / ${formatBytes(evaluation.rawLimit)}` : ""}`
    );
    console.log(
      `   Gzip: ${formatBytes(evaluation.gzipBytes)}${evaluation.gzipLimit ? ` / ${formatBytes(evaluation.gzipLimit)}` : ""}`
    );

    if (evaluation.rawBaseline != null || evaluation.gzipBaseline != null) {
      const rawDeltaStr =
        evaluation.rawBaseline == null
          ? "n/a"
          : `${evaluation.rawDelta >= 0 ? "+" : ""}${formatBytes(evaluation.rawDelta)}`;
      const gzipDeltaStr =
        evaluation.gzipBaseline == null
          ? "n/a"
          : `${evaluation.gzipDelta >= 0 ? "+" : ""}${formatBytes(evaluation.gzipDelta)}`;
      console.log(`   Δ Raw:  ${rawDeltaStr}`);
      console.log(`   Δ Gzip: ${gzipDeltaStr}`);
    }

    if (evaluation.status === "warn") {
      console.warn(`   ⚠️  Approaching budget limit (${evaluation.warnings.join(", ")}).`);
    }
    if (evaluation.status === "fail") {
      hasFailures = true;
      console.error("   ❌ Limit exceeded.");
    }

    reportResults.push({
      name: budget.name,
      description: budget.description ?? null,
      files: fileStats,
      ...evaluation,
    });
  }

  if (reportPath) {
    const report = {
      generatedAt: new Date().toISOString(),
      distDir,
      assetsDir,
      results: reportResults,
    };
    ensureDir(reportPath);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Report written to ${path.relative(rootDir, reportPath)}`);
  }

  if (args.updateBaseline && baselinePath) {
    const nextBaseline = {};
    for (const result of reportResults) {
      if (result.files.length === 0) continue;
      nextBaseline[result.name] = {
        rawBytes: result.rawBytes,
        gzipBytes: result.gzipBytes,
        generatedAt: new Date().toISOString(),
        files: result.files.map((f) => f.path),
      };
    }
    ensureDir(baselinePath);
    writeFileSync(baselinePath, JSON.stringify(nextBaseline, null, 2));
    console.log(`🧭 Baseline updated at ${path.relative(rootDir, baselinePath)}`);
  }

  if (hasMissingRequired) {
    console.error("\n❌ Required bundle assets were not found.");
  }
  if (hasFailures) {
    console.error("❌ Bundle size check failed.");
    process.exit(1);
  }
  if (hasMissingRequired) {
    process.exit(1);
  }

  console.log("\n✅ All bundle size checks passed.");
}

void main();
