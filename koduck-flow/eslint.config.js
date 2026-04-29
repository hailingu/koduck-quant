import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import { globalIgnores } from "eslint/config";

export default tseslint.config([
  globalIgnores(["dist", "coverage", "docs", "node_modules", "rush-logs"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      jsdoc,
    },
    rules: {
      /**
       * JSDoc comment checking rules
       * Reference: docs/templates/comment-templates.md
       */

      // Require exported classes and methods to have JSDoc
      // Temporarily disabled: many functions in the current codebase lack JSDoc; enable after gradual supplementation
      "jsdoc/require-jsdoc": "off",

      // Require parameter descriptions
      // Temporarily disabled: paired with require-jsdoc; enable after JSDoc is complete
      "jsdoc/require-param": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-param-type": "off", // TypeScript type system already provides this

      // Require return value descriptions
      // Temporarily disabled: paired with require-jsdoc; enable after JSDoc is complete
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/require-returns-type": "off", // TypeScript type system already provides this

      // JSDoc syntax checking
      "jsdoc/check-syntax": "error",
      "jsdoc/check-alignment": "warn",
      "jsdoc/check-indentation": "warn",
      "jsdoc/check-line-alignment": "warn",

      // Check tag validity
      "jsdoc/check-tag-names": [
        "warn",
        {
          definedTags: ["remarks", "typeParam", "responsibilities", "fileoverview"],
        },
      ],
      "jsdoc/valid-types": "warn",

      // Example code checking
      "jsdoc/check-examples": "off", // Optional: check if example code is valid

      // Empty descriptions are not allowed
      "jsdoc/require-description": [
        "warn",
        {
          contexts: ["ClassDeclaration", "MethodDefinition", "FunctionDeclaration"],
        },
      ],
    },
  },
  {
    files: ["test/**/*.{ts,tsx}"],
    rules: {
      // Relaxed JSDoc requirements for test files
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      // Test cases often require constructing local mocks, intentionally preserving fixture variables, and using any to simulate bad inputs.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
