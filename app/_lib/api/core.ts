import { beginGlobalLoading, endGlobalLoading } from '@/app/_lib/loadingState';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000/api/v1';

const DEFAULT_GET_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

const GET_RESPONSE_CACHE = new Map<string, CacheEntry>();

export function clearApiCache(): void {
  GET_RESPONSE_CACHE.clear();
}

function buildCacheKey(path: string, token: string | null): string {
  return `${token ?? 'anon'}::${path}`;
}

function getCachedResponse<T>(key: string): T | null {
  const entry = GET_RESPONSE_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    GET_RESPONSE_CACHE.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCachedResponse(key: string, data: unknown, ttlMs: number): void {
  if (ttlMs > 0) GET_RESPONSE_CACHE.set(key, { expiresAt: Date.now() + ttlMs, data });
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getGenericConnectivityMessage(): string {
  return 'ระบบเชื่อมต่อข้อมูลไม่สำเร็จชั่วคราว กรุณาลองใหม่อีกครั้ง';
}

function normalizeApiErrorMessage(status: number, message: string): string {
  const msg = message.trim();
  if (!msg) return getGenericConnectivityMessage();
  const lower = msg.toLowerCase();
  if (
    lower.includes('winerror') ||
    lower.includes('non-blocking socket') ||
    lower.includes('socket operation') ||
    lower.includes('failed to fetch')
  ) return getGenericConnectivityMessage();
  if (status >= 500 && msg === 'Unexpected API error') return getGenericConnectivityMessage();
  return msg;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const rawMessage =
      typeof body === 'string' ? body : body?.detail || body?.message || 'Unexpected API error';
    throw new ApiError(response.status, normalizeApiErrorMessage(response.status, rawMessage));
  }
  return body as T;
}

export interface RequestBehaviorOptions {
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  retryOnAuthError?: boolean;
  showGlobalLoading?: boolean;
}

export type ApiRequestOptions = RequestInit & RequestBehaviorOptions;

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  // Imported lazily to avoid circular dep at module load time
  const { getStoredToken, tryRefreshAccessToken, clearAuthSession, onAuthFailure } =
    await import('./auth-session');

  const {
    forceRefresh = false,
    cacheTtlMs = DEFAULT_GET_CACHE_TTL_MS,
    retryOnAuthError = true,
    showGlobalLoading,
    ...requestOptions
  } = options;

  const token = getStoredToken();
  const method = (requestOptions.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = isGet ? buildCacheKey(path, token) : null;
  const showLoading = showGlobalLoading ?? isGet;

  if (isGet && cacheKey && !forceRefresh) {
    const cached = getCachedResponse<T>(cacheKey);
    if (cached !== null) return cached;
  }
  if (isGet && cacheKey && forceRefresh) GET_RESPONSE_CACHE.delete(cacheKey);

  const headers = new Headers(requestOptions.headers || {});
  if (!headers.has('Content-Type') && requestOptions.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (showLoading) beginGlobalLoading();
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, method, headers });
    } catch {
      throw new ApiError(0, getGenericConnectivityMessage());
    }

    let parsed: T;
    try {
      parsed = await parseResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError && retryOnAuthError && shouldRetryWithRefresh(error)) {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
          return apiRequest<T>(path, {
            ...options,
            retryOnAuthError: false,
            forceRefresh: isGet ? true : forceRefresh,
            showGlobalLoading: false,
          });
        }
        clearAuthSession();
        onAuthFailure?.();
      }
      throw error;
    }

    if (isGet && cacheKey) setCachedResponse(cacheKey, parsed, cacheTtlMs);
    else clearApiCache();

    return parsed;
  } finally {
    if (showLoading) endGlobalLoading();
  }
}

function shouldRetryWithRefresh(error: ApiError): boolean {
  if (error.status === 401) return true;
  if (error.status !== 403) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('role not assigned') || msg.includes('invalid token');
}
