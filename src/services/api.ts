// Merkezi API istemcisi - web'de relative, APK'da VITE_API_URL ile calisir
// Sabit Render: https://futbolcanli.onrender.com (PC kapali da canli)
export const API_BASE: string = (import.meta as any)?.env?.VITE_API_URL || 'https://futbolcanli.onrender.com';

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
