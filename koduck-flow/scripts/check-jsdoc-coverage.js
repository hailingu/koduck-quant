#!/usr/bin/env node

/**
 * JSDoc coverage check script
 *
 * Analyze JSDoc comment coverage in source code and generate detailed reports.
 *
 * Usage:
 *   pnpm docs:coverage
 *   node scripts/check-jsdoc-coverage.js
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const reportsDir = path.join(rootDir, "reports");

/**
 * Ensure the reports directory exists
 */
async function ensureReportsDir() {
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (error) {
    console.error("Failed to create reports directory:", error);
    process.exit(1);
  }
}

/**
 * Check if the file has valid JSDoc comments
 * @param {string} content - File content
 * @returns {boolean} Whether valid JSDoc exists
 */
function hasValidJsDoc(content) {
  const exports =
    content.match(
      /(?:export\s+(?:class|interface|function|type|const|async function|function\*))|(?:declare\s+(?:class|interface|function))/g
    ) || [];
  const jsDocBlocks = content.match(/\/\*\*[\s\S]*?\*\//g) || [];

  // Simple heuristic: return false if there are exports but few JSDoc blocks
  return !(exports.length > 0 && jsDocBlocks.length === 0);
}

/**
 * Check JSDoc coverage
 */
async function checkCoverage() {
  console.log("🔍 Starting JSDoc coverage analysis...\n");

  try {
    // Get all TypeScript files
    const srcDir = path.join(rootDir, "src");
    const files = await glob("**/*.ts", {
      cwd: srcDir,
      ignore: ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"],
    });

    let totalFiles = 0;
    let filesWithJsdoc = 0;
    let fileMetrics = [];

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(srcDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const hasJsdoc = hasValidJsDoc(content);

      if (hasJsdoc) {
        filesWithJsdoc++;
      }

      fileMetrics.push({
        file: path.relative(rootDir, filePath),
        hasJsDoc: hasJsdoc,
      });
    }

    const coverage = totalFiles > 0 ? ((filesWithJsdoc / totalFiles) * 100).toFixed(2) : 0;

    // Output to console
    console.log("📊 JSDoc Coverage Report");
    console.log("━".repeat(50));
    console.log(`Total files:                ${totalFiles}`);
    console.log(`Files with JSDoc:           ${filesWithJsdoc}`);
    console.log(`Files needing JSDoc:        ${totalFiles - filesWithJsdoc}`);
    console.log(`Coverage rate:              ${coverage}%`);
    console.log("━".repeat(50) + "\n");

    // Generate detailed JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles,
        filesWithJsdoc,
        filesWithoutJsdoc: totalFiles - filesWithJsdoc,
        coverage: Number.parseFloat(coverage),
      },
      allFiles: fileMetrics.filter((m) => !m.hasJsDoc),
    };

    await fs.writeFile(
      path.join(reportsDir, "jsdoc-coverage.json"),
      JSON.stringify(report, null, 2)
    );

    // Generate Markdown report
    const mdReport = generateMarkdownReport(report);
    await fs.writeFile(path.join(reportsDir, "jsdoc-coverage-report.md"), mdReport);

    console.log(`✅ Reports generated:`);
    console.log(`   - reports/jsdoc-coverage.json`);
    console.log(`   - reports/jsdoc-coverage-report.md\n`);

    // Return coverage percentage for checking
    return Number.parseFloat(coverage);
  } catch (error) {
    console.error("❌ Error during JSDoc coverage analysis:", error);
    process.exit(1);
  }
}

/**
 * Generate Markdown format report
 * @param {Object} report - Coverage report object
 * @returns {string} Markdown text
 */
function generateMarkdownReport(report) {
  const { summary, allFiles } = report;

  let md = `# JSDoc Coverage Report

**Generated**: ${report.timestamp}

## Summary

| Metric | Value |
|--------|-------|
| Total Files | ${summary.totalFiles} |
| Files with JSDoc | ${summary.filesWithJsdoc} |
| Files needing JSDoc | ${summary.filesWithoutJsdoc} |
| Coverage Rate | ${summary.coverage.toFixed(2)}% |

## Files Needing JSDoc

Total files: ${allFiles.length}

`;

  if (allFiles.length > 0) {
    md += "| File | Status |\n";
    md += "|------|--------|\n";
    for (let index = 0; index < Math.min(allFiles.length, 50); index++) {
      const item = allFiles[index];
      md += `| \`${item.file}\` | ⚠️  Missing JSDoc |\n`;
    }

    if (allFiles.length > 50) {
      md += `| ... | ${allFiles.length - 50} more files |\n`;
    }
  }

  md += `

## Recommendations

1. **Priority P0**: Update critical public APIs first (\`src/common/api/\`)
2. **Priority P1**: Update core modules (\`flow/\`, \`entity/\`, \`event/\`)
3. **Priority P2**: Update supporting modules (\`render/\`, \`engine/\`)
4. **Target**: Achieve 85%+ JSDoc coverage

## Next Steps

- Run \`pnpm docs:lint\` to see detailed error messages
- Reference \`docs/templates/comment-templates.md\` for guidelines
- Check \`.github/PULL_REQUEST_TEMPLATE/comment-review-checklist.md\` for review criteria

---
*For more information, see [Code Comment Improvement Plan](../docs/zh/code-comment-improvement-plan.md)*
`;

  return md;
}

// Run check
await ensureReportsDir();
await checkCoverage();
