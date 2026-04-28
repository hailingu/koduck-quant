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
            name: "koduck-flow",
            importNames: ["deity", "legacyDeity", "getDeity", "globalKokoduckFlowRuntime"],
            message:
              "Legacy deity API is deprecated. Use KokoduckFlowProvider + useKokoduckFlowRuntime() instead. See docs/api-unification-migration-guide.md",
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
          "Global deity is deprecated. Use useKokoduckFlowRuntime() hook in React components or createKokoduckFlowRuntime() in scripts.",
      },
    ],

    // Disallow specific patterns
    "no-restricted-syntax": [
      "error",
      {
        selector: 'MemberExpression[object.name="deity"]',
        message:
          "deity API is deprecated. Use runtime from useKokoduckFlowRuntime() or createKokoduckFlowRuntime().",
      },
      {
        selector: 'CallExpression[callee.name="getDeity"]',
        message:
          "getDeity() is deprecated. Use createKokoduckFlowRuntime() or getDeityRuntime() as temporary solution.",
      },
      {
        selector: 'MemberExpression[object.name="legacyDeity"]',
        message: "legacyDeity is deprecated. Use KokoduckFlowProvider + Hooks pattern.",
      },
      {
        selector: 'MemberExpression[object.name="globalKokoduckFlowRuntime"]',
        message:
          "globalKokoduckFlowRuntime is deprecated. Use KokoduckFlowProvider for React or createKokoduckFlowRuntime() for scripts.",
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
