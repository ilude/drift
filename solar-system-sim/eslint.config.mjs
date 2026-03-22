import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
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
        rules: {
            'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },
    {
        ignores: ['node_modules/', 'dist/', 'coverage/'],
    },
];
