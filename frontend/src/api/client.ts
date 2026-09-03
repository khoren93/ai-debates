import axios, { isAxiosError } from 'axios';

export const api = axios.create({
  // In production (Caddy) and in `vite dev` (proxy) the API lives under /api.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 90_000,
  // The login is a same-site session cookie.
  withCredentials: true,
});

/** HTTP status of an API error, if any. */
export function getErrorStatus(err: unknown): number | null {
  return isAxiosError(err) && err.response ? err.response.status : null;
}

/** Extract a human-readable message from an API/network error. */
export function getErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first.msg === 'string') return first.msg.replace(/^Value error, /, '');
    }
    if (err.response) return `Request failed (${err.response.status})`;
    return 'Network error: could not reach the server';
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
