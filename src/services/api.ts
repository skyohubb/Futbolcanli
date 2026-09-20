// Merkezi API istemcisi - web'de relative, APK'da VITE_API_URL ile calisir
// APK build: VITE_API_URL=https://<sunucu-adresin> npm run build
export const API_BASE: string = (import.meta as any)?.env?.VITE_API_URL || '';

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  return `${API_BASE}${path}`;
}

export async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}
