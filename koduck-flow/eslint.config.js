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
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      jsdoc,
    },
    rules: {
      /**
       * JSDoc 注释检查规则
       * 参考: docs/templates/comment-templates.md
       */

      // 要求导出的类、方法必须有 JSDoc
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          publicOnly: true,
          checkGetters: true,
          checkSetters: true,
        },
      ],

      // 要求参数有说明
      "jsdoc/require-param": [
        "warn",
        {
          checkDestructuredRoots: false,
        },
      ],
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-param-type": "off", // TypeScript 类型系统已提供

      // 要求返回值有说明
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/require-returns-type": "off", // TypeScript 类型系统已提供

      // JSDoc 语法检查
      "jsdoc/check-syntax": "error",
      "jsdoc/check-alignment": "warn",
      "jsdoc/check-indentation": "warn",
      "jsdoc/check-line-alignment": "warn",

      // 检查标记有效性
      "jsdoc/check-tag-names": "warn",
      "jsdoc/valid-types": "warn",

      // 示例代码检查
      "jsdoc/check-examples": "off", // 可选：检查示例代码是否有效

      // 不允许空描述
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
      // 测试文件的 JSDoc 要求宽松一些
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
    },
  },
]);
