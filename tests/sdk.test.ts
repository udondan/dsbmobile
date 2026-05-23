import { describe, expect, test } from 'vitest';
import * as sdk from '../dist/index.js';

describe('SDK exports', () => {
  test('DsbmobileClient is exported as a constructor', () => {
    expect(typeof sdk.DsbmobileClient).toBe('function');
    expect(sdk.DsbmobileClient.prototype).toBeDefined();
  });

  test('DsbmobileClient can be instantiated with config', () => {
    const client = new sdk.DsbmobileClient({ username: 'u', password: 'p' });
    expect(client).toBeInstanceOf(sdk.DsbmobileClient);
  });

  test('DsbmobileClient instance has expected methods', () => {
    const client = new sdk.DsbmobileClient({ username: 'u', password: 'p' });
    expect(typeof client.getTimetables).toBe('function');
    expect(typeof client.getSubstitutions).toBe('function');
    expect(typeof client.getNews).toBe('function');
    expect(typeof client.getDocuments).toBe('function');
  });

  test('parseSubstitutionHtml is exported as a function', () => {
    expect(typeof sdk.parseSubstitutionHtml).toBe('function');
  });

  test('startMcpServer is not part of the public SDK surface', () => {
    expect(sdk).not.toHaveProperty('startMcpServer');
  });
});
