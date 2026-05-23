import { AxiosError } from 'axios';

/**
 * Converts an API error into a human-readable, actionable error message.
 * Credentials are never included in error messages.
 */
export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      switch (error.response.status) {
        case 401: {
          return 'Error: Authentication failed. Please verify your credentials are correct.';
        }
        case 403: {
          return 'Error: Access denied. Your account may not have permission to access this resource.';
        }
        case 404: {
          return 'Error: Resource not found. The DSBmobile API endpoint may have changed.';
        }
        case 429: {
          return 'Error: Rate limit exceeded. Please wait a moment before making more requests.';
        }
        case 500:
        case 502:
        case 503:
        case 504: {
          return 'Error: DSBmobile service is temporarily unavailable. Please try again later.';
        }
        default: {
          return `Error: API request failed with status ${error.response.status}. Please try again.`;
        }
      }
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'Error: Request timed out. The DSBmobile service may be slow or unavailable. Please try again.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'Error: Cannot connect to DSBmobile. Please check your internet connection and try again.';
    }
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return 'Error: An unexpected error occurred. Please try again.';
}

/**
 * Creates an error message for authentication failure (empty token response).
 */
export function createAuthError(): string {
  return 'Error: Authentication failed. DSBmobile rejected the provided credentials. Please verify your credentials are correct.';
}
