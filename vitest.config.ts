import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Testdateien teilen sich die SQLite-Dev-DB (z. B. HA-Lease) -> sequentiell ausführen
    fileParallelism: false,
    // Ein Fork: gleiche DB-Datei, keine parallelen Worker mit eigenem Lock
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
