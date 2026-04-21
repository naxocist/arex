import { apiRequest, type RequestBehaviorOptions } from './core';
import type { LogisticsCancelledPickupJobItem, LogisticsFactoryOptionItem, LogisticsPickupQueueItem, LogisticsPickupJobItem, LogisticsApprovedRewardRequestItem, LogisticsRewardDeliveryJobItem, SchedulePickupPayload, SchedulePickupResponse, ScheduleRewardDeliveryPayload, ScheduleRewardDeliveryResponse, LogisticsInfoItem, UpsertLogisticsInfoPayload } from './types';

export const logisticsApi = {
  listFactories: (params?: { material_type?: string; quantity_kg?: number; submission_id?: string }, options?: RequestBehaviorOptions) => {
    const qs = params ? Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
    return apiRequest<{ factories: LogisticsFactoryOptionItem[]; actor: string }>(`/logistics/factories${qs ? `?${qs}` : ''}`, options);
  },
  getPickupQueue: (options?: RequestBehaviorOptions) =>
    apiRequest<{ queue: LogisticsPickupQueueItem[]; actor: string }>('/logistics/pickup-queue', options),
  getPickupJobs: (options?: RequestBehaviorOptions) =>
    apiRequest<{ jobs: LogisticsPickupJobItem[]; actor: string }>('/logistics/pickup-jobs', options),
  getApprovedRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ queue: LogisticsApprovedRewardRequestItem[]; actor: string }>('/logistics/reward-requests/approved', options),
  getRewardDeliveryJobs: (options?: RequestBehaviorOptions) =>
    apiRequest<{ jobs: LogisticsRewardDeliveryJobItem[]; actor: string }>('/logistics/reward-delivery-jobs', options),
  schedulePickup: (submissionId: string, payload: SchedulePickupPayload) =>
    apiRequest<SchedulePickupResponse>(`/logistics/pickup-jobs/${submissionId}/schedule`, { method: 'POST', body: JSON.stringify(payload) }),
  markPickedUp: (pickupJobId: string) =>
    apiRequest(`/logistics/pickup-jobs/${pickupJobId}/picked-up`, { method: 'POST' }),
  markDeliveredToFactory: (pickupJobId: string) =>
    apiRequest(`/logistics/pickup-jobs/${pickupJobId}/delivered-to-factory`, { method: 'POST' }),
  scheduleRewardDelivery: (requestId: string, payload: ScheduleRewardDeliveryPayload) =>
    apiRequest<ScheduleRewardDeliveryResponse>(`/logistics/reward-delivery-jobs/${requestId}/schedule`, { method: 'POST', body: JSON.stringify(payload) }),
  markRewardOutForDelivery: (deliveryJobId: string) =>
    apiRequest(`/logistics/reward-delivery-jobs/${deliveryJobId}/out-for-delivery`, { method: 'POST' }),
  markRewardDelivered: (deliveryJobId: string) =>
    apiRequest(`/logistics/reward-delivery-jobs/${deliveryJobId}/delivered`, { method: 'POST' }),
  reschedulePickup: (pickupJobId: string, payload: SchedulePickupPayload) =>
    apiRequest(`/logistics/pickup-jobs/${pickupJobId}/reschedule`, { method: 'PATCH', body: JSON.stringify(payload) }),
  rescheduleDeliveryJob: (deliveryJobId: string, payload: ScheduleRewardDeliveryPayload) =>
    apiRequest(`/logistics/reward-delivery-jobs/${deliveryJobId}/reschedule`, { method: 'PATCH', body: JSON.stringify(payload) }),
  cancelSubmission: (submissionId: string, reason?: string) =>
    apiRequest(`/logistics/submissions/${submissionId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason ?? null }) }),
  cancelPickupJob: (pickupJobId: string, reason?: string) =>
    apiRequest(`/logistics/pickup-jobs/${pickupJobId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason ?? null }) }),
  getCancelledPickupJobs: (options?: RequestBehaviorOptions) =>
    apiRequest<{ jobs: LogisticsCancelledPickupJobItem[]; actor: string }>('/logistics/pickup-jobs/cancelled', options),
  getRouteDistance: (fromLat: number, fromLng: number, toLat: number, toLng: number) =>
    apiRequest<{ distance_km: number | null }>(`/logistics/route-distance?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`),
  getMyInfo: (options?: RequestBehaviorOptions) =>
    apiRequest<LogisticsInfoItem>('/logistics/me', options),
  updateMyInfo: (payload: UpsertLogisticsInfoPayload) =>
    apiRequest<LogisticsInfoItem>('/logistics/me', { method: 'PUT', body: JSON.stringify(payload) }),
};
