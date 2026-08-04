import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the built bundle can be served from any sub-path.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/game/**', 'src/ui/ranking.ts'],
    },
  },
});
