import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (!(error instanceof TypeError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

export default defineConfig({
  test: {},
});
