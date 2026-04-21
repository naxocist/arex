import { apiRequest, type RequestBehaviorOptions } from './core';
import type { AdminProfile, AdminSettings, AdminOverview } from './types';

export const adminApi = {
  getOverview: (options?: RequestBehaviorOptions) =>
    apiRequest<AdminOverview>('/admin/dashboard/overview', options),
  listAllAccounts: (options?: RequestBehaviorOptions) =>
    apiRequest<{ accounts: AdminProfile[] }>('/admin/accounts/all', options),
  toggleAccount: (profileId: string) =>
    apiRequest<{ message: string; account: AdminProfile }>(`/admin/accounts/${encodeURIComponent(profileId)}/toggle`, { method: 'POST' }),
  getSettings: (options?: RequestBehaviorOptions) =>
    apiRequest<{ settings: AdminSettings }>('/admin/settings', options),
  updateSettings: (approvalRequiredRoles: string[]) =>
    apiRequest<{ message: string; settings: AdminSettings }>('/admin/settings', { method: 'PUT', body: JSON.stringify({ approval_required_roles: approvalRequiredRoles }) }),
};
