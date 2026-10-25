const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
module.exports = [js.configs.recommended, ...tseslint.configs.recommended, {
  files: ['**/*.ts'],
  languageOptions: { parser: tseslint.parser, globals: { process: 'readonly', console: 'readonly' } },
  rules: { '@typescript-eslint/no-explicit-any': 'error', 'no-console': 'off' },
}];
