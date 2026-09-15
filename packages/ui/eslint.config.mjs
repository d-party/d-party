import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  ...storybook.configs["flat/recommended"],
  {
    files: ["**/*.stories.tsx"],
    rules: {
      // このパッケージの story は extension（react-vite）と frontend（nextjs-vite）の
      // 双方の Storybook から読まれる。どちらか一方のフレームワークパッケージに
      // 依存させられないので、レンダラである @storybook/react から型を取る。
      "storybook/no-renderer-packages": "off",
    },
  },
);
