import globals from "globals";
import js from "@eslint/js";
import ts from "typescript-eslint";

export default [
  { languageOptions: { globals: globals.browser } },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...ts.configs.stylistic,
  {
    rules: {
      "indent": ["warn", 2, { "SwitchCase": 1 }],
      "linebreak-style": ["warn", "unix"],
      "quotes": ["warn", "double"],
      "semi": ["warn", "always"],
      "max-len": ["warn", { "code": 120 }],
      "@typescript-eslint/consistent-type-definitions": ["off"],
    }
  }
];
