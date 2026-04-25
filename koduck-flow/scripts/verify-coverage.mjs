#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const coverageFile = path.resolve(projectRoot, "coverage/coverage-final.json");

if (!fs.existsSync(coverageFile)) {
  console.error("[coverage] Missing coverage artifact: coverage/coverage-final.json");
  console.error("Run `pnpm run test:coverage` before invoking coverage verification.");
  process.exit(1);
}

const normalize = (filePath) =>
  filePath.replace(/\\/g, "/").replace(projectRoot.replace(/\\/g, "/") + "/", "");

const priorityRenderFiles = [
  "src/common/render/render-frame-scheduler.ts",
  "src/common/render/render-metrics-utils.ts",
  "src/common/render/render-diagnostics.ts",
  "src/common/render/render-manager/render-strategy-controller.ts",
];

const priorityRenderSet = new Set(priorityRenderFiles.map((file) => file.replace(/\\/g, "/")));

const coverageData = JSON.parse(fs.readFileSync(coverageFile, "utf-8"));

const aggregateCoverage = (matcher) => {
  let totalStatements = 0;
  let coveredStatements = 0;
  const matchedFiles = [];

  for (const [absolutePath, fileCoverage] of Object.entries(coverageData)) {
    const relativePath = normalize(absolutePath);
    if (!matcher(relativePath)) {
      continue;
    }

    const statementIds = Object.keys(fileCoverage.statementMap ?? {});
    const statements = statementIds.length;
    if (statements === 0) {
      continue;
    }

    const covered = statementIds.reduce((acc, id) => {
      const hitCount = fileCoverage.s?.[id] ?? 0;
      return acc + (hitCount > 0 ? 1 : 0);
    }, 0);

    totalStatements += statements;
    coveredStatements += covered;
    matchedFiles.push(relativePath);
  }

  return {
    totalStatements,
    coveredStatements,
    matchedFiles,
    ratio: totalStatements === 0 ? 0 : coveredStatements / totalStatements,
  };
};

const groups = [
  {
    name: "Components",
    description: "src/components/**/*.tsx",
    threshold: 0.65,
    result: aggregateCoverage(
      (relativePath) =>
        relativePath.startsWith("src/components/") &&
        (relativePath.endsWith(".tsx") || relativePath.endsWith(".ts"))
    ),
  },
  {
    name: "Render Priority Files",
    description: priorityRenderFiles.join(", "),
    threshold: 0.85,
    result: aggregateCoverage((relativePath) => priorityRenderSet.has(relativePath)),
  },
  {
    name: "Global Source",
    description: "src/**/*.ts(x)",
    threshold: 0.8,
    result: aggregateCoverage(
      (relativePath) =>
        relativePath.startsWith("src/") &&
        (relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"))
    ),
  },
];

let hasFailure = false;

for (const group of groups) {
  const coveragePercent = group.result.ratio * 100;
  const formattedPercent = isNaN(coveragePercent) ? "0.00" : coveragePercent.toFixed(2);
  const thresholdPercent = (group.threshold * 100).toFixed(2);

  if (group.result.totalStatements === 0) {
    console.warn(
      `[coverage] ${group.name}: no instrumented statements were found for matcher (${group.description}).`
    );
    hasFailure = true;
    continue;
  }

  const statusIcon = coveragePercent >= group.threshold * 100 ? "✅" : "❌";

  console.log(
    `[coverage] ${statusIcon} ${group.name}: ${formattedPercent}% statements ` +
      `(threshold ${thresholdPercent}%) ` +
      `across ${group.result.matchedFiles.length} files (covered ${group.result.coveredStatements}/${group.result.totalStatements}).`
  );

  if (coveragePercent < group.threshold * 100) {
    hasFailure = true;
  }
}

if (hasFailure) {
  console.error("[coverage] Coverage verification failed. See log above for details.");
  process.exit(1);
}

console.log("[coverage] All coverage thresholds satisfied.");
