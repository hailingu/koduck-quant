/**
 * Codemod: Migrate test files to use createTestRuntime
 *
 * This codemod automatically transforms test files to use isolated runtime instances.
 *
 * Usage:
 *   npx jscodeshift -t migrate-tests.ts --extensions=test.ts,test.tsx test/
 */

import type { API, FileInfo } from "jscodeshift";

export default function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let hasChanges = false;

  // Check if this is a test file
  const isTestFile = file.path.includes(".test.") || file.path.includes(".spec.");

  if (!isTestFile) {
    return null;
  }

  // Step 1: Remove deity imports
  root.find(j.ImportDeclaration).forEach((path) => {
    const importSource = path.node.source.value as string;

    if (importSource === "duck-flow" || importSource.startsWith("duck-flow/")) {
      const specifiers = path.node.specifiers || [];

      // Remove deity-related imports
      const filteredSpecifiers = specifiers.filter((spec) => {
        if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
          const name = spec.imported.name;
          return !["deity", "legacyDeity", "getDeity", "globalDuckFlowRuntime"].includes(name);
        }
        return true;
      });

      if (filteredSpecifiers.length === 0) {
        j(path).remove();
        hasChanges = true;
      } else if (filteredSpecifiers.length !== specifiers.length) {
        path.node.specifiers = filteredSpecifiers;
        hasChanges = true;
      }
    }
  });

  // Step 2: Check if using deity
  const usesDeity = root.find(j.Identifier, { name: "deity" }).length > 0;

  if (!usesDeity) {
    return null; // No migration needed
  }

  // Step 3: Add createTestRuntime import
  const hasTestRuntimeImport =
    root.find(j.ImportDeclaration, {
      source: { value: "../test/utils/runtime" },
    }).length > 0;

  if (!hasTestRuntimeImport) {
    const newImport = j.importDeclaration(
      [j.importSpecifier(j.identifier("createTestRuntime"))],
      j.literal("../test/utils/runtime")
    );

    // Insert at top after other imports
    const lastImport = root.find(j.ImportDeclaration).at(-1);
    if (lastImport.length > 0) {
      lastImport.insertAfter(newImport);
    } else {
      root.find(j.Program).get("body", 0).insertBefore(newImport);
    }
    hasChanges = true;
  }

  // Step 4: Add DuckFlowRuntime type import
  const hasDuckFlowRuntimeType = root
    .find(j.ImportDeclaration, {
      source: { value: "duck-flow" },
    })
    .some((path) => {
      return path.node.specifiers?.some(
        (spec) =>
          spec.type === "ImportSpecifier" &&
          spec.imported.type === "Identifier" &&
          spec.imported.name === "DuckFlowRuntime"
      );
    });

  if (!hasDuckFlowRuntimeType) {
    const duckFlowImports = root.find(j.ImportDeclaration, {
      source: { value: "duck-flow" },
    });

    if (duckFlowImports.length > 0) {
      duckFlowImports.forEach((path) => {
        const specifiers = path.node.specifiers || [];
        specifiers.push(
          j.importSpecifier(j.identifier("DuckFlowRuntime"), j.identifier("DuckFlowRuntime"))
        );
        // Make it a type import
        if (path.node.importKind !== "type") {
          // Check if all are types, otherwise keep as value import
          const typeSpec = j.importSpecifier(j.identifier("DuckFlowRuntime"));
          typeSpec.importKind = "type";
          specifiers.push(typeSpec);
        }
      });
      hasChanges = true;
    } else {
      const typeImport = j.importDeclaration(
        [j.importSpecifier(j.identifier("DuckFlowRuntime"))],
        j.literal("duck-flow")
      );
      typeImport.importKind = "type";

      const lastImport = root.find(j.ImportDeclaration).at(-1);
      if (lastImport.length > 0) {
        lastImport.insertAfter(typeImport);
      }
      hasChanges = true;
    }
  }

  // Step 5: Find describe blocks and add beforeEach/afterEach
  root
    .find(j.CallExpression, {
      callee: { name: "describe" },
    })
    .forEach((describePath) => {
      const describeArgs = describePath.node.arguments;

      if (describeArgs.length < 2) return;

      const callback = describeArgs[1];
      if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") {
        return;
      }

      if (callback.body.type !== "BlockStatement") return;

      const body = callback.body.body;

      // Check if this describe block uses deity
      const usesDeityInDescribe = j(describePath).find(j.Identifier, { name: "deity" }).length > 0;

      if (!usesDeityInDescribe) return;

      // Add runtime variable declaration
      const runtimeDeclaration = j.variableDeclaration("let", [
        j.variableDeclarator(j.identifier("runtime"), null),
      ]);

      // Add type annotation
      const runtimeVar = runtimeDeclaration.declarations[0];
      if (runtimeVar.id.type === "Identifier") {
        runtimeVar.id.typeAnnotation = j.tsTypeAnnotation(
          j.tsTypeReference(j.identifier("DuckFlowRuntime"))
        );
      }

      // Create beforeEach
      const beforeEachCall = j.expressionStatement(
        j.callExpression(j.identifier("beforeEach"), [
          j.arrowFunctionExpression(
            [],
            j.blockStatement([
              j.expressionStatement(
                j.assignmentExpression(
                  "=",
                  j.identifier("runtime"),
                  j.callExpression(j.identifier("createTestRuntime"), [])
                )
              ),
            ])
          ),
        ])
      );

      // Create afterEach
      const afterEachCall = j.expressionStatement(
        j.callExpression(j.identifier("afterEach"), [
          j.arrowFunctionExpression(
            [],
            j.blockStatement([
              j.expressionStatement(
                j.callExpression(
                  j.memberExpression(j.identifier("runtime"), j.identifier("dispose")),
                  []
                )
              ),
            ])
          ),
        ])
      );

      // Insert at beginning of describe
      body.unshift(afterEachCall);
      body.unshift(beforeEachCall);
      body.unshift(runtimeDeclaration);

      hasChanges = true;
    });

  // Step 6: Replace deity with runtime
  root.find(j.Identifier, { name: "deity" }).forEach((path) => {
    if (path.parent.node.type === "MemberExpression" && path.parent.node.object === path.node) {
      path.node.name = "runtime";
      hasChanges = true;
    }
  });

  return hasChanges ? root.toSource() : null;
}
