import { defineConfig } from 'vitest/config';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export default defineConfig({
  test: {
    coverage: {
      // Measure every source file, including those no test imports.
      include: ['src/**/*.ts'],
      thresholds: { 100: true },
    },
  },
});
