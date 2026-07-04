import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/_archived']), // _archived is gitignored dead code
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
      // React Compiler diagnostics (react-hooks v6 recommended) kept as WARNINGS:
      // this app isn't compiled with the React Compiler, and these flag intentional
      // patterns (Math.random for animation jitter, manual memoization, syncing state
      // from async/props, co-locating a hook with its component). The critical
      // 'react-hooks/rules-of-hooks' stays an ERROR. Revisit on React Compiler adoption.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  // Vercel serverless functions run in Node — expose Node globals (process, Buffer, ...)
  {
    files: ['api/**/*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
  // Service worker runs in a worker scope — expose ServiceWorker globals (self, ...)
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: globals.serviceworker,
      sourceType: 'script',
    },
  },
])
