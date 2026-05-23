import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cliPath = path.resolve(new URL('..', import.meta.url).pathname, 'dist', 'cli.js');

function runCli(arguments_: string[], environment: Record<string, string> = {}) {
  return spawnSync('node', [cliPath, ...arguments_], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...environment },
    timeout: 5000,
  });
}

describe('CLI help and version', () => {
  test('--help lists all subcommands', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('mcp');
    expect(result.stdout).toContain('substitutions');
    expect(result.stdout).toContain('timetables');
    expect(result.stdout).toContain('news');
    expect(result.stdout).toContain('documents');
  });

  test('--version prints a semver string', () => {
    const result = runCli(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('substitutions --help shows --class option', () => {
    const result = runCli(['substitutions', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--class');
  });
});

describe('CLI credential validation', () => {
  const noCredentials = { DSB_USERNAME: '', DSB_PASSWORD: '' };
  const noPassword = { DSB_USERNAME: 'user', DSB_PASSWORD: '' };
  const noUsername = { DSB_USERNAME: '', DSB_PASSWORD: 'pass' };

  for (const command of ['substitutions', 'timetables', 'news', 'documents', 'mcp']) {
    test(`${command} exits 1 when both credentials missing`, () => {
      const result = runCli([command], noCredentials);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Error:');
      expect(result.stderr).toContain('DSB_USERNAME');
      expect(result.stderr).toContain('DSB_PASSWORD');
    });

    test(`${command} exits 1 when only DSB_PASSWORD missing`, () => {
      const result = runCli([command], noPassword);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('DSB_PASSWORD');
    });

    test(`${command} exits 1 when only DSB_USERNAME missing`, () => {
      const result = runCli([command], noUsername);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('DSB_USERNAME');
    });
  }
});
