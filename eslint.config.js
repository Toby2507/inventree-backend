/* eslint-disable @typescript-eslint/no-require-imports */
const { defineConfig, globalIgnores } = require('eslint/config');

const tsParser = require('@typescript-eslint/parser');
const typescriptEslintEslintPlugin = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: { '@typescript-eslint': typescriptEslintEslintPlugin },
    extends: compat.extends('plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'),
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': ['error', { printWidth: 100 }, { usePrettierrc: true }],
      'no-restricted-imports': ['error', { patterns: ['@app/contexts/*/**'] }],
    },
  },
  globalIgnores(['**/.eslintrc.js']),
  {
    files: ['libs/testing/**', '**/test/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
