import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sourceFiles = ['packages/*/{src,test}/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'];

const noUiOrRenderer = [
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'three', 'three/*'],
    message: 'This package must stay free of React and Three.js (AGENTS.md section 2).',
  },
];

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/dev-dist/', '**/coverage/']),
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },

  js.configs.recommended,
  tseslint.configs.recommended,

  // Type-aware rules for application and package source.
  {
    files: sourceFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  // Runtime globals.
  { files: ['*.{js,ts}', 'apps/*/*.ts'], languageOptions: { globals: globals.node } },
  {
    files: ['apps/web/src/**', 'packages/ui/src/**', 'packages/game-core/src/**'],
    languageOptions: { globals: globals.browser },
  },

  // Layering: dependencies point downward only (AGENTS.md section 2).
  {
    files: ['packages/finance-engine/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@credit-runner/*'],
              message: 'finance-engine imports nothing from the repo.',
            },
            ...noUiOrRenderer,
          ],
        },
      ],
    },
  },
  {
    files: ['packages/scenarios/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@credit-runner/*', '!@credit-runner/finance-engine'],
              message: 'scenarios may only depend on finance-engine.',
            },
            ...noUiOrRenderer,
          ],
        },
      ],
    },
  },
  {
    files: ['packages/game-core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@credit-runner/*'],
              message: 'game-core imports nothing from the repo.',
            },
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'game-core must not depend on React (AGENTS.md section 2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@credit-runner/finance-engine',
              allowTypeImports: true,
              message: 'ui may import finance-engine types only; apps/web wires engine calls.',
            },
          ],
          patterns: [
            {
              group: ['@credit-runner/*', '!@credit-runner/finance-engine'],
              message: 'ui may only depend on finance-engine types.',
            },
            {
              group: ['three', 'three/*'],
              message: 'ui must not depend on Three.js.',
            },
          ],
        },
      ],
    },
  },
]);
