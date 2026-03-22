import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                window: 'readonly',
                document: 'readonly',
                performance: 'readonly',
                localStorage: 'readonly',
                requestAnimationFrame: 'readonly',
                console: 'readonly',
                HTMLCanvasElement: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['serve.js'],
        languageOptions: {
            globals: {
                Bun: 'readonly',
                Response: 'readonly',
                URL: 'readonly',
                console: 'readonly',
            },
        },
    },
    {
        ignores: ['node_modules/', 'dist/', 'coverage/', 'serve.js'],
    },
];
