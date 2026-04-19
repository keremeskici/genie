export function getBackendApiUrl(): string | null {
  const raw = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;

  const trimmed = raw.replace(/\/$/, '');
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return '';

  const trimmed = raw.replace(/\/$/, '');
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function getPublicApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicApiBaseUrl()}${normalizedPath}`;
}
