import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Flat config. Two rules here are not style, they are brief invariants:
 *  - packages/engine must not read the clock (CLAUDE.md rule 9, brief section 8).
 *  - packages/ingest must stay framework-agnostic (brief section 4).
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  {
    // Everything here runs on Node: the scripts, the worker, the ingest pipeline.
    languageOptions: { globals: { ...globals.node } },
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
  {
    // brief section 8 / CLAUDE.md rule 9: "Time is a parameter. No hidden clock reads
    // inside engines." Every engine function takes `now`, so the simulator and the
    // time-travel tests can move the clock themselves.
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'engines take `now` as an argument (CLAUDE.md rule 9)' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'engines take `now` as an argument (CLAUDE.md rule 9)',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'engines take `now` as an argument (CLAUDE.md rule 9)',
        },
      ],
    },
  },
  {
    // brief section 4: ingest must be framework-agnostic so it can move to its own service.
    files: ['packages/ingest/**/*.ts', 'packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*'],
              message:
                'packages/ingest and packages/engine must not import Next.js (brief section 4)',
            },
            {
              group: ['@dripmetric/web', '../../apps/*'],
              message: 'packages must not import from apps/* (CLAUDE.md invariants)',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/__tests__/**/*.ts', 'packages/sim/**/*.ts', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
