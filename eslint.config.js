import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import angular from "@angular-eslint/eslint-plugin";

export default [
  {
    ignores: ["dist/**", "build/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json"
      },
      globals: {
        console: "readonly",
        performance: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        document: "readonly",
        window: "readonly",
        devicePixelRatio: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@angular-eslint": angular
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@angular-eslint/component-selector": "off"
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  }
];
