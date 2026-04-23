import { API_BASE_URL } from './core';
import { ACCESS_TOKEN_KEY } from './auth-session';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

function extractGcsPath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  if (!urlOrPath.startsWith('http')) return urlOrPath;
  const m = urlOrPath.match(/storage\.googleapis\.com\/[^/]+\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function uploadSubmissionImage(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/images/upload/submission`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
  const data = await res.json();
  return data.path as string;
}

export async function uploadRewardImage(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/images/upload/reward`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
  const data = await res.json();
  // Return signed URL for immediate display; backend re-signs on subsequent reads
  return data.url as string;
}

export async function deleteSubmissionImage(urlOrPath: string): Promise<void> {
  const path = extractGcsPath(urlOrPath);
  if (!path) return;
  const token = getToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/images?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteRewardImage(urlOrPath: string): Promise<void> {
  const path = extractGcsPath(urlOrPath);
  if (!path) return;
  const token = getToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/images?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
