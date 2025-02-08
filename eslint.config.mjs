import js from '@eslint/js';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'indent': ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'no-unused-vars': ['warn']
        }
    },
    {
        files: ['**/*.test.js', '**/*.spec.js'],
        plugins: {
            jest: jestPlugin
        },
        rules: {
            ...jestPlugin.configs.recommended.rules,
            'jest/valid-expect': 'error',
            'jest/no-disabled-tests': 'warn',
            'jest/no-focused-tests': 'error',
            'jest/prefer-to-be': 'warn'
        }
    },
    {
        ignores: ['dist/*', 'node_modules/*']
    }
];