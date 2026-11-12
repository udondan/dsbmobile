import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, test } from 'vitest';
import { createAuthError, handleApiError } from '../src/utils/errors.js';

function responseError(status: number): AxiosError {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    data: undefined,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe('handleApiError', () => {
  test.each([
    [401, 'Authentication failed'],
    [403, 'Access denied'],
    [404, 'Resource not found'],
    [429, 'Rate limit exceeded'],
    [500, 'temporarily unavailable'],
    [502, 'temporarily unavailable'],
    [503, 'temporarily unavailable'],
    [504, 'temporarily unavailable'],
    [418, 'API request failed with status 418'],
  ])('maps HTTP status %i', (status, expected) => {
    const message = handleApiError(responseError(status));
    expect(message).toMatch(/^Error: /);
    expect(message).toContain(expected);
  });

  test.each(['ECONNABORTED', 'ETIMEDOUT'])('maps %s to a timeout message', (code) => {
    expect(handleApiError(new AxiosError('timeout', code))).toContain('Request timed out');
  });

  test.each(['ENOTFOUND', 'ECONNREFUSED'])('maps %s to a connection message', (code) => {
    expect(handleApiError(new AxiosError('offline', code))).toContain('Cannot connect');
  });

  test('falls back to the message of an AxiosError without response or known code', () => {
    expect(handleApiError(new AxiosError('socket hang up', 'ECONNRESET'))).toBe(
      'Error: socket hang up',
    );
  });

  test('prefixes the message of a plain Error', () => {
    expect(handleApiError(new Error('boom'))).toBe('Error: boom');
  });

  test('returns a generic message for values that are not errors', () => {
    expect(handleApiError('boom')).toBe('Error: An unexpected error occurred. Please try again.');
  });
});

describe('createAuthError', () => {
  test('returns an error message about rejected credentials', () => {
    const message = createAuthError();
    expect(message).toMatch(/^Error: /);
    expect(message).toContain('rejected the provided credentials');
  });
});
