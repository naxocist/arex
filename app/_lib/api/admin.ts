import { apiRequest, type RequestBehaviorOptions } from './core';
import type { AdminProfile, AdminSettings, AdminOverview } from './types';

export const adminApi = {
  getOverview: (options?: RequestBehaviorOptions) =>
    apiRequest<AdminOverview>('/admin/dashboard/overview', options),
  listPendingAccounts: (roleFilter?: string) =>
    apiRequest<{ accounts: AdminProfile[] }>(`/admin/accounts/pending${roleFilter ? `?role_filter=${encodeURIComponent(roleFilter)}` : ''}`),
  listAllAccounts: (params?: { role_filter?: string; approval_filter?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role_filter) qs.set('role_filter', params.role_filter);
    if (params?.approval_filter) qs.set('approval_filter', params.approval_filter);
    const query = qs.toString();
    return apiRequest<{ accounts: AdminProfile[] }>(`/admin/accounts/all${query ? `?${query}` : ''}`);
  },
  approveAccount: (profileId: string) =>
    apiRequest<{ message: string }>(`/admin/accounts/${encodeURIComponent(profileId)}/approve`, { method: 'POST' }),
  rejectAccount: (profileId: string, note?: string) =>
    apiRequest<{ message: string }>(`/admin/accounts/${encodeURIComponent(profileId)}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  getSettings: (options?: RequestBehaviorOptions) =>
    apiRequest<{ settings: AdminSettings }>('/admin/settings', options),
  updateSettings: (approvalRequiredRoles: string[]) =>
    apiRequest<{ message: string; settings: AdminSettings }>('/admin/settings', { method: 'PUT', body: JSON.stringify({ approval_required_roles: approvalRequiredRoles }) }),
};
