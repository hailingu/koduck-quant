/**
 * ESLint configuration for API migration
 *
 * This configuration adds rules to prevent usage of deprecated APIs
 * during the migration process.
 */

module.exports = {
  extends: ["../../.eslintrc.js"],

  rules: {
    // Disallow deity API usage
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "duck-flow",
            importNames: ["deity", "legacyDeity", "getDeity", "globalDuckFlowRuntime"],
            message:
              "Legacy deity API is deprecated. Use DuckFlowProvider + useDuckFlowRuntime() instead. See docs/api-unification-migration-guide.md",
          },
        ],
      },
    ],

    // Disallow global deity usage
    "no-restricted-globals": [
      "error",
      {
        name: "deity",
        message:
          "Global deity is deprecated. Use useDuckFlowRuntime() hook in React components or createDuckFlowRuntime() in scripts.",
      },
    ],

    // Disallow specific patterns
    "no-restricted-syntax": [
      "error",
      {
        selector: 'MemberExpression[object.name="deity"]',
        message:
          "deity API is deprecated. Use runtime from useDuckFlowRuntime() or createDuckFlowRuntime().",
      },
      {
        selector: 'CallExpression[callee.name="getDeity"]',
        message:
          "getDeity() is deprecated. Use createDuckFlowRuntime() or getDeityRuntime() as temporary solution.",
      },
      {
        selector: 'MemberExpression[object.name="legacyDeity"]',
        message: "legacyDeity is deprecated. Use DuckFlowProvider + Hooks pattern.",
      },
      {
        selector: 'MemberExpression[object.name="globalDuckFlowRuntime"]',
        message:
          "globalDuckFlowRuntime is deprecated. Use DuckFlowProvider for React or createDuckFlowRuntime() for scripts.",
      },
    ],
  },

  overrides: [
    {
      // Less strict for test files during migration
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      rules: {
        "no-restricted-imports": "warn",
        "no-restricted-globals": "warn",
        "no-restricted-syntax": "warn",
      },
    },
    {
      // Allow in migration scripts themselves
      files: ["scripts/migration/**"],
      rules: {
        "no-restricted-imports": "off",
        "no-restricted-globals": "off",
        "no-restricted-syntax": "off",
      },
    },
  ],
};
