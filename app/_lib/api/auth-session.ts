import { API_BASE_URL, clearApiCache } from './core';

export const ACCESS_TOKEN_KEY = 'AREX_ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'AREX_REFRESH_TOKEN';
const AUTH_ROLE_KEY = 'AREX_AUTH_ROLE';
const AUTH_APPROVAL_KEY = 'AREX_APPROVAL_STATUS';

export let authRefreshInFlight: Promise<boolean> | null = null;
export let onAuthFailure: (() => void) | null = null;

export function registerAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_ROLE_KEY);
}

export function getStoredApprovalStatus(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_APPROVAL_KEY);
}

export function setAuthSession(params: {
  accessToken: string;
  refreshToken?: string | null;
  role?: string | null;
  approvalStatus?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  clearApiCache();
  localStorage.setItem(ACCESS_TOKEN_KEY, params.accessToken);
  if (params.refreshToken !== undefined) {
    if (params.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, params.refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  if (params.role !== undefined) {
    if (params.role) localStorage.setItem(AUTH_ROLE_KEY, params.role);
    else localStorage.removeItem(AUTH_ROLE_KEY);
  }
  if (params.approvalStatus !== undefined) {
    if (params.approvalStatus) localStorage.setItem(AUTH_APPROVAL_KEY, params.approvalStatus);
    else localStorage.removeItem(AUTH_APPROVAL_KEY);
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  clearApiCache();
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(AUTH_APPROVAL_KEY);
}

export async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  if (authRefreshInFlight) return authRefreshInFlight;

  authRefreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as {
        access_token?: string | null;
        refresh_token?: string | null;
        user?: { role?: string | null };
      };
      if (!body?.access_token) return false;
      setAuthSession({
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? null,
        role: body.user?.role ?? null,
      });
      return true;
    } catch {
      return false;
    } finally {
      authRefreshInFlight = null;
    }
  })();

  return authRefreshInFlight;
}
