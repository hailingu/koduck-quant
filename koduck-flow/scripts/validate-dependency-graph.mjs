#!/usr/bin/env node

/**
 * Dependency Graph Validation Script
 *
 * Uses madge to validate that the dependency graph is a DAG (Directed Acyclic Graph)
 * and check for circular dependencies between key components.
 */

import madge from "madge";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateDependencyGraph() {
  try {
    console.log("🔍 Validating dependency graph with madge...");

    // Analyze the source code
    const result = await madge(join(__dirname, "../src"), {
      fileExtensions: ["ts", "tsx", "js", "jsx"],
      excludeRegExp: [
        /node_modules/,
        /\.test\./,
        /\.spec\./,
        /__tests__/,
        /__mocks__/,
        /dist/,
        /build/,
        /coverage/,
        /\.d\.ts$/,
        /scripts/,
        /benchmarks/,
        /docs/,
        /stories/,
      ],
      tsConfig: join(__dirname, "../tsconfig.json"),
    });

    // Check for circular dependencies
    const circular = result.circular();
    if (circular.length > 0) {
      console.error("❌ Circular dependencies detected:");
      circular.forEach((cycle, index) => {
        console.error(`  ${index + 1}. ${cycle.join(" -> ")}`);
      });
      process.exit(1);
    }

    // Check for specific problematic patterns
    const problematicPatterns = [
      {
        name: "RegistryManager <-> EntityManager",
        files: ["**/registry/registry-manager.ts", "**/entity/entity-manager.ts"],
      },
      {
        name: "RegistryManager <-> RenderManager",
        files: ["**/registry/registry-manager.ts", "**/render/render-manager/**"],
      },
      {
        name: "EntityManager <-> RenderManager",
        files: ["**/entity/entity-manager.ts", "**/render/render-manager/**"],
      },
    ];

    let hasIssues = false;

    for (const pattern of problematicPatterns) {
      const files = result.obj();
      const patternFiles = Object.keys(files).filter((file) =>
        pattern.files.some((patternFile) => file.includes(patternFile.replace("**/", "")))
      );

      if (patternFiles.length >= 2) {
        // Check if any of these files have circular dependencies with each other
        for (const file of patternFiles) {
          const deps = files[file] || [];
          for (const dep of deps) {
            if (patternFiles.some((pf) => dep.includes(pf.replace("**/", "")))) {
              console.warn(`⚠️  Potential circular dependency pattern detected: ${pattern.name}`);
              console.warn(`   ${file} -> ${dep}`);
              hasIssues = true;
            }
          }
        }
      }
    }

    if (hasIssues) {
      console.warn("⚠️  Dependency graph validation completed with warnings");
      process.exit(1);
    }

    console.log("✅ Dependency graph validation passed - no circular dependencies detected");
    console.log(`📊 Analyzed ${Object.keys(result.obj()).length} files`);
  } catch (error) {
    console.error("❌ Error during dependency graph validation:", error);
    process.exit(1);
  }
}

validateDependencyGraph();
