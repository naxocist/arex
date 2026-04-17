import { apiRequest, type RequestBehaviorOptions } from './core';
import type { WarehousePendingRequestItem, RejectRewardRequestPayload } from './types';

export const warehouseApi = {
  listPendingRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ requests: WarehousePendingRequestItem[]; actor: string }>('/warehouse/reward-requests/pending', options),
  listAnsweredRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ requests: WarehousePendingRequestItem[]; actor: string }>('/warehouse/reward-requests/answered', options),
  approveRewardRequest: (requestId: string) =>
    apiRequest<{ message: string; result: unknown }>(`/warehouse/reward-requests/${requestId}/approve`, { method: 'POST' }),
  rejectRewardRequest: (requestId: string, payload: RejectRewardRequestPayload) =>
    apiRequest<{ message: string; result: unknown }>(`/warehouse/reward-requests/${requestId}/reject`, { method: 'POST', body: JSON.stringify(payload) }),
};
