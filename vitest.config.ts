import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional — not present in CI
}

export default defineConfig({
  test: {},
});
