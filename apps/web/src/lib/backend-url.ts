/**
 * Same-origin API URL helpers.
 *
 * The backend now lives inside this Next.js app (single Vercel deployment), so every
 * `/api/...` endpoint is served from the same origin. These helpers return relative
 * paths; there is no separate backend base URL anymore.
 */

export function getPublicApiBaseUrl(): string {
  return '';
}

export function getPublicApiUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}
