import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['dist/*', 'node_modules/*', 'cod/*', 'coverage/*', 'integration-tests/*', 'src/demo'],
        },
        include: ['src/lib/**/*.test.js'],
        exclude: ['node_modules', 'dist', 'cod', 'coverage', 'integration-tests'],
    },
    resolve: {
        alias: {
            'virtual:svg-icons': resolve(__dirname, './vitest/vitest.mock.js'),
        },
    },
});