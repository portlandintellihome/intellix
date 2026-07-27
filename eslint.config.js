import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'ios/App/App/public']),
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
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Backend + Node tooling run under Node, not the browser — give them Node
  // globals (process, Buffer, console, __dirname, …) so they aren't flagged
  // no-undef. Without this every server file's `process.env` reads as an error.
  {
    files: ['server/**/*.js', 'scripts/**/*.{js,mjs}', '*.config.js', 'capacitor.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
