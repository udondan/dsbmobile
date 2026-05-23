// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript recommended + type-checked rules
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Unicorn best practices
  unicorn.configs['flat/recommended'],

  // Prettier (must come last to disable conflicting rules)
  prettierConfig,

  {
    plugins: { prettier: prettierPlugin },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.lint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    },
  },

  // Ignore build output and node_modules
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // Disable type-checked rules for the eslint config file itself
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
