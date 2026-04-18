export function getBackendApiUrl(): string | null {
  const raw = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;

  const trimmed = raw.replace(/\/$/, '');
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}
