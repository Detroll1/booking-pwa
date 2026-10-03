import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist', 'node_modules', 'coverage', 'playwright-report', 'test-results', 'supabase/functions', 'theme.template.ts', 'src/sw.ts', 'dist', 'dev-dist', 'tests/e2e', 'public', 'src/themes/app/app.js', 'src/themes/app/app.d.ts', 'src/themes/app/app.variants.d.ts']},
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', {allowNumber: true}],
    },
  },
  {
    files: ['**/*.mjs', 'eslint.config.js', 'vitest.config.ts', 'vite.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.mjs', '*.config.js'],
    languageOptions: {
      globals: {process: 'readonly', console: 'readonly', fetch: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly'},
    },
  },
);
