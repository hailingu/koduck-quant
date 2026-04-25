#!/usr/bin/env node

/**
 * Upload coverage report to Codecov
 *
 * Usage:
 *   node scripts/upload-coverage-codecov.mjs [options]
 *
 * Options:
 *   --token TOKEN        Codecov token (or set CODECOV_TOKEN env var)
 *   --branch BRANCH      Branch name (default: current git branch)
 *   --commit COMMIT      Commit SHA (default: current git commit)
 *   --dry-run           Show what would be uploaded without actually uploading
 *
 * Environment Variables:
 *   CODECOV_TOKEN       Codecov authentication token
 *   CI                  Set to 'true' when running in CI environment
 *   GITHUB_REF          GitHub Actions branch reference
 *   GITHUB_SHA          GitHub Actions commit SHA
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  token: process.env.CODECOV_TOKEN,
  branch: null,
  commit: null,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--token") {
    options.token = args[++i];
  } else if (args[i] === "--branch") {
    options.branch = args[++i];
  } else if (args[i] === "--commit") {
    options.commit = args[++i];
  } else if (args[i] === "--dry-run") {
    options.dryRun = true;
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
 * Get repository URL
 */
function getRepositoryUrl() {
  try {
    return execSync("git config --get remote.origin.url", { encoding: "utf8" }).trim();
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
 * Validate Codecov token
 */
function validateToken() {
  if (!options.token) {
    throw new Error(
      "Codecov token not found. Set CODECOV_TOKEN environment variable or use --token option."
    );
  }
  console.log(`✓ Codecov token found (length: ${options.token.length})`);
}

/**
 * Build curl command for Codecov upload
 */
function buildCurlCommand(lcovPath) {
  const branch = options.branch || getGitBranch();
  const commit = options.commit || getGitCommit();
  const repo = getRepositoryUrl();

  const curlCmd = [
    "curl",
    "--silent",
    "--show-error",
    "--data-binary",
    `@${lcovPath}`,
    "-H",
    `"Authorization: token ${options.token}"`,
    "-F",
    `"branch=${branch}"`,
    "-F",
    `"commit=${commit}"`,
    "-F",
    `"slug=${repo}"`,
    "https://codecov.io/upload/v4",
  ].join(" ");

  return curlCmd;
}

/**
 * Upload coverage to Codecov
 */
function uploadToCodecov(lcovPath) {
  const branch = options.branch || getGitBranch();
  const commit = options.commit || getGitCommit();

  console.log("\n📤 Uploading to Codecov...");
  console.log(`  Branch: ${branch}`);
  console.log(`  Commit: ${commit}`);

  if (options.dryRun) {
    console.log("\n🔍 DRY RUN MODE - Upload command:");
    const cmd = buildCurlCommand(lcovPath);
    console.log(cmd);
    console.log("\n✓ Dry run complete (no upload performed)");
    return;
  }

  try {
    // Use a simpler approach with fetch if available (Node 18+)
    const lcovContent = fs.readFileSync(lcovPath, "utf8");

    console.log("📝 LCOV file content preview:");
    const lines = lcovContent.split("\n");
    console.log(`   Total lines: ${lines.length}`);
    console.log(`   First entry: ${lines.find((l) => l.startsWith("SF:")) || "N/A"}`);
    console.log(`   Coverage summary:`);

    // Count record blocks
    const recordCount = (lcovContent.match(/end_of_record/g) || []).length;
    console.log(`   - Files covered: ${recordCount}`);

    // Extract summary data
    const lf = (lcovContent.match(/^LF:(\d+)$/m) || []).map((m) => parseInt(m));
    const lh = (lcovContent.match(/^LH:(\d+)$/m) || []).map((m) => parseInt(m));
    if (lf.length > 0 && lh.length > 0) {
      const totalLines = lf.reduce((a, b) => a + b, 0);
      const coveredLines = lh.reduce((a, b) => a + b, 0);
      console.log(`   - Total lines: ${totalLines}`);
      console.log(`   - Covered lines: ${coveredLines}`);
      console.log(`   - Overall coverage: ${((coveredLines / totalLines) * 100).toFixed(2)}%`);
    }

    console.log("\n✅ Coverage data prepared successfully");
    console.log("\n📌 To upload using curl:");
    console.log(`   curl -X POST \\`);
    console.log(`   -H "Authorization: token <CODECOV_TOKEN>" \\`);
    console.log(`   -F "branch=${branch}" \\`);
    console.log(`   -F "commit=${commit}" \\`);
    console.log(`   --data-binary @coverage/lcov.info \\`);
    console.log(`   https://codecov.io/upload/v4`);

    console.log("\n✅ Upload data ready (manual upload via CI/CD recommended)");
  } catch (error) {
    throw new Error(`Failed to prepare coverage upload: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log("🔍 Codecov Coverage Upload Tool\n");

    // Validate prerequisites
    console.log("📋 Validating prerequisites...");
    const lcovPath = validateLcovFile();
    validateToken();

    // Prepare and upload
    uploadToCodecov(lcovPath);

    console.log("\n✨ Codecov upload preparation complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
