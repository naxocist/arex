import { ACCESS_TOKEN_KEY } from './auth-session';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';

export async function uploadRewardImage(file: File): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) throw new Error('Not authenticated');
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/reward-images/${fileName}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/reward-images/${fileName}`;
}

export async function deleteRewardImage(imageUrl: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) return;
  const marker = '/reward-images/';
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const fileName = imageUrl.slice(idx + marker.length);
  await fetch(`${SUPABASE_URL}/storage/v1/object/reward-images/${fileName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
