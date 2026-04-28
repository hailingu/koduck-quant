/**
 * Codemod: Migrate from deity API to KoduckFlowProvider + Hooks
 *
 * This codemod automatically transforms React components to use the new Provider pattern.
 *
 * Usage:
 *   npx jscodeshift -t migrate-to-provider.ts --extensions=tsx,ts src/
 */

import type { API, FileInfo } from "jscodeshift";

export default function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let hasChanges = false;

  // Check if this is a React component file
  const hasReactImport =
    root.find(j.ImportDeclaration, {
      source: { value: "react" },
    }).length > 0;

  if (!hasReactImport) {
    return null; // Skip non-React files
  }

  // Step 1: Remove deity imports
  root.find(j.ImportDeclaration).forEach((path) => {
    const importSource = path.node.source.value as string;

    if (importSource === "koduck-flow" || importSource.startsWith("koduck-flow/")) {
      const specifiers = path.node.specifiers || [];

      // Remove deity-related imports
      const filteredSpecifiers = specifiers.filter((spec) => {
        if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
          const name = spec.imported.name;
          return !["deity", "legacyDeity", "getDeity", "globalKoduckFlowRuntime"].includes(name);
        }
        return true;
      });

      if (filteredSpecifiers.length === 0) {
        // Remove entire import if no specifiers left
        j(path).remove();
        hasChanges = true;
      } else if (filteredSpecifiers.length !== specifiers.length) {
        // Update import with filtered specifiers
        path.node.specifiers = filteredSpecifiers;
        hasChanges = true;
      }
    }
  });

  // Step 2: Add new imports
  const hasUseKoduckFlowRuntime =
    root.find(j.ImportDeclaration, {
      source: { value: "koduck-flow" },
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { name: "useKoduckFlowRuntime" },
        },
      ],
    }).length > 0;

  if (!hasUseKoduckFlowRuntime) {
    // Find existing koduck-flow import or create new one
    const koduckFlowImports = root.find(j.ImportDeclaration, {
      source: { value: "koduck-flow" },
    });

    if (koduckFlowImports.length > 0) {
      // Add to existing import
      koduckFlowImports.forEach((path) => {
        const specifiers = path.node.specifiers || [];
        const hasHook = specifiers.some(
          (spec) =>
            spec.type === "ImportSpecifier" &&
            spec.imported.type === "Identifier" &&
            spec.imported.name === "useKoduckFlowRuntime"
        );

        if (!hasHook) {
          specifiers.push(j.importSpecifier(j.identifier("useKoduckFlowRuntime")));
          hasChanges = true;
        }
      });
    } else {
      // Create new import
      const newImport = j.importDeclaration(
        [j.importSpecifier(j.identifier("useKoduckFlowRuntime"))],
        j.literal("koduck-flow")
      );

      // Insert after React import
      const reactImport = root.find(j.ImportDeclaration, {
        source: { value: "react" },
      });

      if (reactImport.length > 0) {
        reactImport.at(-1).insertAfter(newImport);
      } else {
        // Insert at top
        root.find(j.Program).get("body", 0).insertBefore(newImport);
      }
      hasChanges = true;
    }
  }

  // Step 3: Replace deity usage in function components
  root.find(j.FunctionDeclaration).forEach((funcPath) => {
    const funcBody = funcPath.node.body;

    // Check if function uses deity
    const usesDeity =
      j(funcPath).find(j.MemberExpression, {
        object: { name: "deity" },
      }).length > 0;

    if (usesDeity) {
      // Add runtime hook at the beginning of function
      const runtimeDeclaration = j.variableDeclaration("const", [
        j.variableDeclarator(
          j.identifier("runtime"),
          j.callExpression(j.identifier("useKoduckFlowRuntime"), [])
        ),
      ]);

      funcBody.body.unshift(runtimeDeclaration);

      // Replace deity with runtime
      j(funcPath)
        .find(j.MemberExpression, {
          object: { name: "deity" },
        })
        .forEach((memberPath) => {
          memberPath.node.object = j.identifier("runtime");
        });

      hasChanges = true;
    }
  });

  // Step 4: Replace deity usage in arrow function components
  root.find(j.VariableDeclarator).forEach((varPath) => {
    const init = varPath.node.init;

    if (init && init.type === "ArrowFunctionExpression") {
      const usesDeity =
        j(varPath).find(j.MemberExpression, {
          object: { name: "deity" },
        }).length > 0;

      if (usesDeity && init.body.type === "BlockStatement") {
        // Add runtime hook
        const runtimeDeclaration = j.variableDeclaration("const", [
          j.variableDeclarator(
            j.identifier("runtime"),
            j.callExpression(j.identifier("useKoduckFlowRuntime"), [])
          ),
        ]);

        init.body.body.unshift(runtimeDeclaration);

        // Replace deity with runtime
        j(varPath)
          .find(j.MemberExpression, {
            object: { name: "deity" },
          })
          .forEach((memberPath) => {
            memberPath.node.object = j.identifier("runtime");
          });

        hasChanges = true;
      }
    }
  });

  // Step 5: Handle class components (add comment suggesting manual migration)
  root.find(j.ClassDeclaration).forEach((classPath) => {
    const usesDeity =
      j(classPath).find(j.MemberExpression, {
        object: { name: "deity" },
      }).length > 0;

    if (usesDeity) {
      // Add comment
      const comment = j.commentBlock(
        "\n" +
          " TODO: Manual migration needed for class component\n" +
          " Consider converting to function component or wrapping with KoduckFlowProvider\n" +
          " See: docs/api-unification-migration-guide.md\n" +
          " ",
        true,
        false
      );

      if (!classPath.node.comments) {
        classPath.node.comments = [];
      }
      classPath.node.comments.push(comment);
      hasChanges = true;
    }
  });

  return hasChanges ? root.toSource() : null;
}
