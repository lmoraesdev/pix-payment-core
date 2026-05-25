import { resolve } from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test/helpers': resolve(__dirname, 'test/helpers/index.ts'),
      '@test/builders': resolve(__dirname, 'test/builders/index.ts'),
      '@test/fakes': resolve(__dirname, 'test/fakes/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
        },
      },
    }),
  ],
});
