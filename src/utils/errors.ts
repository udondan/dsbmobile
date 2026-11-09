import { AxiosError } from 'axios';

const SERVICE_UNAVAILABLE =
  'Error: DSBmobile service is temporarily unavailable. Please try again later.';
const TIMEOUT =
  'Error: Request timed out. The DSBmobile service may be slow or unavailable. Please try again.';
const NO_CONNECTION =
  'Error: Cannot connect to DSBmobile. Please check your internet connection and try again.';

/** Messages for HTTP status codes of an API response. */
const STATUS_MESSAGES: Partial<Record<number, string>> = {
  401: 'Error: Authentication failed. Please verify your credentials are correct.',
  403: 'Error: Access denied. Your account may not have permission to access this resource.',
  404: 'Error: Resource not found. The DSBmobile API endpoint may have changed.',
  429: 'Error: Rate limit exceeded. Please wait a moment before making more requests.',
  500: SERVICE_UNAVAILABLE,
  502: SERVICE_UNAVAILABLE,
  503: SERVICE_UNAVAILABLE,
  504: SERVICE_UNAVAILABLE,
};

/** Messages for network error codes when there is no response. */
const NETWORK_MESSAGES = new Map<string | undefined, string>([
  ['ECONNABORTED', TIMEOUT],
  ['ETIMEDOUT', TIMEOUT],
  ['ENOTFOUND', NO_CONNECTION],
  ['ECONNREFUSED', NO_CONNECTION],
]);

function axiosErrorMessage(error: AxiosError): string | undefined {
  if (error.response) {
    const { status } = error.response;
    return (
      STATUS_MESSAGES[status] ??
      `Error: API request failed with status ${status}. Please try again.`
    );
  }
  return NETWORK_MESSAGES.get(error.code);
}

/**
 * Converts an API error into a human-readable, actionable error message.
 * Credentials are never included in error messages.
 */
export function handleApiError(error: unknown): string {
  const message = error instanceof AxiosError ? axiosErrorMessage(error) : undefined;
  if (message) return message;
  return error instanceof Error
    ? `Error: ${error.message}`
    : 'Error: An unexpected error occurred. Please try again.';
}

/**
 * Creates an error message for authentication failure (empty token response).
 */
export function createAuthError(): string {
  return 'Error: Authentication failed. DSBmobile rejected the provided credentials. Please verify your credentials are correct.';
}
