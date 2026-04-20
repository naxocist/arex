import { apiRequest, type RequestBehaviorOptions } from './core';
import type { AdminProfile, AdminSettings, AdminOverview } from './types';

export const adminApi = {
  getOverview: (options?: RequestBehaviorOptions) =>
    apiRequest<AdminOverview>('/admin/dashboard/overview', options),
  listAllAccounts: (params?: { role_filter?: string; approval_filter?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role_filter) qs.set('role_filter', params.role_filter);
    if (params?.approval_filter) qs.set('approval_filter', params.approval_filter);
    const query = qs.toString();
    return apiRequest<{ accounts: AdminProfile[] }>(`/admin/accounts/all${query ? `?${query}` : ''}`);
  },
  toggleAccount: (profileId: string) =>
    apiRequest<{ message: string; account: AdminProfile }>(`/admin/accounts/${encodeURIComponent(profileId)}/toggle`, { method: 'POST' }),
  getSettings: (options?: RequestBehaviorOptions) =>
    apiRequest<{ settings: AdminSettings }>('/admin/settings', options),
  updateSettings: (approvalRequiredRoles: string[]) =>
    apiRequest<{ message: string; settings: AdminSettings }>('/admin/settings', { method: 'PUT', body: JSON.stringify({ approval_required_roles: approvalRequiredRoles }) }),
};
