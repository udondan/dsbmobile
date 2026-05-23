import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const indexFilePath = path.resolve(root, 'dist', 'index.js');
const cliFilePath = path.resolve(root, 'dist', 'cli.js');

const packageJson = createRequire(import.meta.url)('../package.json') as Record<string, unknown>;

describe('package.json entry points', () => {
  test('name is @udondan/dsbmobile', () => {
    expect(packageJson.name).toBe('@udondan/dsbmobile');
  });

  test('main points to dist/index.js', () => {
    expect(packageJson.main).toBe('dist/index.js');
  });

  test('types points to dist/index.d.ts', () => {
    expect(packageJson.types).toBe('dist/index.d.ts');
  });

  test('bin.dsbmobile points to dist/cli.js', () => {
    const bin = packageJson.bin as Record<string, string>;
    expect(bin.dsbmobile).toBe('dist/cli.js');
  });

  test('exports map . to dist/index.js', () => {
    const exports_ = packageJson.exports as Record<string, Record<string, string>>;
    expect(exports_['.'].import).toBe('./dist/index.js');
    expect(exports_['.'].types).toBe('./dist/index.d.ts');
  });
});

describe('compiled dist/ output', () => {
  test('dist/index.js exists after build', () => {
    expect(existsSync(indexFilePath)).toBe(true);
  });

  test('dist/cli.js exists after build', () => {
    expect(existsSync(cliFilePath)).toBe(true);
  });

  test('dist/cli.js has #!/usr/bin/env node shebang', () => {
    const content = readFileSync(cliFilePath, 'utf8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  test('dist/index.js does not start a server (is a module, not an executable)', () => {
    const content = readFileSync(indexFilePath, 'utf8');
    expect(content).not.toContain('StdioServerTransport');
    expect(content).not.toContain('process.exit');
  });
});
