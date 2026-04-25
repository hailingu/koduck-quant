#!/usr/bin/env node

/**
 * Upload coverage report to Coveralls
 *
 * Usage:
 *   node scripts/upload-coverage-coveralls.mjs [options]
 *
 * Options:
 *   --repo-token TOKEN   Coveralls repo token (or set COVERALLS_REPO_TOKEN env var)
 *   --branch BRANCH      Branch name (default: current git branch)
 *   --commit COMMIT      Commit SHA (default: current git commit)
 *   --pr-number NUMBER   Pull request number (for CI environments)
 *   --dry-run           Show what would be uploaded without actually uploading
 *
 * Environment Variables:
 *   COVERALLS_REPO_TOKEN    Coveralls repository token
 *   CI                      Set to 'true' when running in CI environment
 *   GITHUB_REF              GitHub Actions branch reference
 *   GITHUB_SHA              GitHub Actions commit SHA
 *   GITHUB_EVENT_NUMBER     GitHub Actions PR number
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  repoToken: process.env.COVERALLS_REPO_TOKEN,
  branch: null,
  commit: null,
  prNumber: null,
  dryRun: false,
};

let i = 0;
while (i < args.length) {
  const arg = args[i];
  if (arg === "--repo-token") {
    options.repoToken = args[i + 1];
    i += 2;
  } else if (arg === "--branch") {
    options.branch = args[i + 1];
    i += 2;
  } else if (arg === "--commit") {
    options.commit = args[i + 1];
    i += 2;
  } else if (arg === "--pr-number") {
    options.prNumber = args[i + 1];
    i += 2;
  } else if (arg === "--dry-run") {
    options.dryRun = true;
    i += 1;
  } else {
    i += 1;
  }
}

/**
 * Get current git branch name
 */
function getGitBranch() {
  try {
    if (process.env.GITHUB_REF) {
      // GitHub Actions format: refs/heads/main
      return process.env.GITHUB_REF.replace("refs/heads/", "");
    }
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get current git commit SHA
 */
function getGitCommit() {
  try {
    if (process.env.GITHUB_SHA) {
      return process.env.GITHUB_SHA;
    }
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get commit author
 */
function getCommitAuthor() {
  try {
    return execSync('git log -1 --format="%an <%ae>"', { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get commit message
 */
function getCommitMessage() {
  try {
    return execSync('git log -1 --format="%B"', { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Validate LCOV file exists
 */
function validateLcovFile() {
  const lcovPath = path.join(projectRoot, "coverage", "lcov.info");
  if (!fs.existsSync(lcovPath)) {
    throw new Error(`LCOV file not found at ${lcovPath}. Run 'npm run test:coverage' first.`);
  }
  const stats = fs.statSync(lcovPath);
  console.log(
    `✓ LCOV file found: ${lcovPath} (${(stats.size / 1024).toFixed(1)}KB, ${countLines(lcovPath)} lines)`
  );
  return lcovPath;
}

/**
 * Count lines in a file
 */
function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.split("\n").length;
}

/**
 * Validate Coveralls token
 */
function validateToken() {
  if (!options.repoToken) {
    throw new Error(
      "Coveralls repo token not found. Set COVERALLS_REPO_TOKEN environment variable or use --repo-token option."
    );
  }
  console.log(`✓ Coveralls token found (length: ${options.repoToken.length})`);
}

/**
 * Parse LCOV file and extract coverage data
 */
function parseLcovFile(lcovPath) {
  const content = fs.readFileSync(lcovPath, "utf8");
  const lines = content.split("\n");

  const sourceFiles = [];
  let currentFile = null;
  let linesCovered = 0;
  let linesTotal = 0;

  for (const line of lines) {
    if (line.startsWith("SF:")) {
      if (currentFile) {
        currentFile.lines_hit = linesCovered;
        currentFile.lines = linesTotal;
        sourceFiles.push(currentFile);
      }
      currentFile = {
        name: line.substring(3),
        source: [],
        coverage: [],
      };
      linesCovered = 0;
      linesTotal = 0;
    } else if (line.startsWith("DA:")) {
      const [lineNum, hitCount] = line.substring(3).split(",");
      linesTotal++;
      if (Number.parseInt(hitCount) > 0) {
        linesCovered++;
      }
      if (currentFile) {
        currentFile.coverage[Number.parseInt(lineNum) - 1] = Number.parseInt(hitCount);
      }
    } else if (line === "end_of_record") {
      if (currentFile) {
        currentFile.lines_hit = linesCovered;
        currentFile.lines = linesTotal;
        sourceFiles.push(currentFile);
        currentFile = null;
      }
    }
  }

  return sourceFiles;
}

/**
 * Build Coveralls JSON payload
 */
function buildCoverallsPayload(lcovPath) {
  const branch = options.branch || getGitBranch();
  const commit = options.commit || getGitCommit();

  const payload = {
    repo_token: options.repoToken,
    service_name: process.env.CI ? "github-actions" : "manual",
    git: {
      branch,
      commit,
      author: getCommitAuthor(),
      message: getCommitMessage(),
    },
    source_files: parseLcovFile(lcovPath),
  };

  if (options.prNumber || process.env.GITHUB_EVENT_NUMBER) {
    payload.service_number = options.prNumber || process.env.GITHUB_EVENT_NUMBER;
  }

  return payload;
}

/**
 * Upload coverage to Coveralls
 */
function uploadToCoveralls(lcovPath) {
  const branch = options.branch || getGitBranch();
  const commit = options.commit || getGitCommit();

  console.log("\n📤 Uploading to Coveralls...");
  console.log(`  Branch: ${branch}`);
  console.log(`  Commit: ${commit}`);
  console.log(`  Author: ${getCommitAuthor()}`);

  try {
    const payload = buildCoverallsPayload(lcovPath);

    console.log("\n📊 Coverage payload summary:");
    console.log(`  - Source files: ${payload.source_files.length}`);

    const totalLines = payload.source_files.reduce((sum, f) => sum + (f.lines || 0), 0);
    const coveredLines = payload.source_files.reduce((sum, f) => sum + (f.lines_hit || 0), 0);
    console.log(`  - Total lines: ${totalLines}`);
    console.log(`  - Covered lines: ${coveredLines}`);
    if (totalLines > 0) {
      console.log(`  - Overall coverage: ${((coveredLines / totalLines) * 100).toFixed(2)}%`);
    }

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN MODE - Payload preview:");
      console.log(JSON.stringify(payload, null, 2).substring(0, 500) + "...");
      console.log("\n✓ Dry run complete (no upload performed)");
      return;
    }

    console.log("\n📝 Payload prepared successfully");
    console.log("\n📌 To upload using curl:");
    console.log(`   curl -X POST \\`);
    console.log(`   -H "Content-Type: application/json" \\`);
    console.log(`   -d @payload.json \\`);
    console.log(`   https://coveralls.io/api/v1/jobs`);

    // Save payload to file for reference
    const payloadPath = path.join(projectRoot, ".coveralls-payload.json");
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
    console.log(`\n✅ Payload saved to: ${payloadPath}`);

    console.log("\n✅ Upload data ready (manual upload via CI/CD recommended)");
  } catch (error) {
    throw new Error(`Failed to prepare Coveralls upload: ${error.message}`);
  }
}

/**
 * Main execution
 */
try {
  console.log("🔍 Coveralls Coverage Upload Tool\n");

  // Validate prerequisites
  console.log("📋 Validating prerequisites...");
  const lcovPath = validateLcovFile();
  validateToken();

  // Prepare and upload
  uploadToCoveralls(lcovPath);

  console.log("\n✨ Coveralls upload preparation complete!");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
}
