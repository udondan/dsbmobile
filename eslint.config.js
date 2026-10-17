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
  unicorn.configs.recommended,

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
      // Keep the usual JSDoc style: leading asterisks and single-line `/** ... */` comments.
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/single-line-block-comment-style': 'off',
      // Iterator#toArray() and Map.groupBy() are not part of the ES2022 lib we compile against.
      'unicorn/prefer-iterator-to-array': 'off',
      'unicorn/prefer-group-by': 'off',
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
