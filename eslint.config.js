import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      // Сторонний код локальной установки GSD Core (не наш, в .gitignore)
      '.claude/gsd-*/',
      '.claude/hooks/gsd-*',
      '.claude/hooks/lib/*.js',
      '.claude/hooks/managed-hooks-registry.cjs',
      '.claude/scripts/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
