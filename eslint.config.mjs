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
                ...globals.jest,
            },
        },
        rules: {
            'indent': [
                'error', 4,
                'SwitchCase', 4
            ],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'no-unused-vars': ['warn', {
                'vars': 'all',
                'args': 'after-used',
                'ignoreRestSiblings': true,
                'varsIgnorePattern': '^_',
                'argsIgnorePattern': '^_',
            }],
            //'no-console': ['warn'],
            'no-debugger': 'error',
            'no-duplicate-case': 'error',
            'no-empty': 'warn',
            'no-irregular-whitespace': 'error',
            'no-unreachable': 'error',
        
            // Best Practices
            'curly': ['error', 'all'],
            'default-case': 'warn',
            'eqeqeq': 'error',
            'no-caller': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-throw-literal': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
        
            // Style
            'array-bracket-spacing': ['error', 'never'],
            'block-spacing': 'error',
            'brace-style': ['error', '1tbs'],
            'comma-dangle': ['error', 'always-multiline'],
            'comma-spacing': 'error',
            'key-spacing': 'error',
            'max-len': ['warn', { 'code': 120 }],
            'no-multiple-empty-lines': ['error', { 'max': 1 }],
            'object-curly-spacing': ['error', 'always'],
            'space-before-blocks': 'error',
            'space-before-function-paren': ['error', {
                'anonymous': 'always',
                'named': 'never',
                'asyncArrow': 'always',
            }],
        },
    },
    {
        files: ['**/*.test.js', '**/*.spec.js'],
        plugins: {
            jest: jestPlugin,
        },
        rules: {
            ...jestPlugin.configs.recommended.rules,
            'jest/valid-expect': 'error',
            'jest/no-disabled-tests': 'warn',
            'jest/no-focused-tests': 'error',
            'jest/prefer-to-be': 'warn',
        },
    },
    {
        ignores: ['dist/*', 'node_modules/*', 'cod/*', 'coverage/*'],
    },
];