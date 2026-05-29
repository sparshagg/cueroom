import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/.next/**", "**/dist/**", "**/coverage/**", "**/node_modules/**", "pnpm-lock.yaml"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,mjs,js,jsx}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        crypto: "readonly",
        setInterval: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        chrome: "readonly",
        HTMLMediaElement: "readonly",
        MutationObserver: "readonly",
        MediaStream: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }]
    }
  }
];
