import { apiRequest, type RequestBehaviorOptions } from './core';
import type { FarmerMaterialTypeItem, FarmerMeasurementUnitItem, FarmerRewardItem, FarmerRewardRequestItem, FarmerSubmissionItem, CreateSubmissionPayload, CreateRewardRequestPayload } from './types';

export const farmerApi = {
  getMe: (options?: RequestBehaviorOptions) =>
    apiRequest<{ user_id: string; email: string | null; role: string }>('/farmer/me', options),
  listMaterialTypes: (options?: RequestBehaviorOptions) =>
    apiRequest<{ material_types: FarmerMaterialTypeItem[]; actor: string }>('/farmer/material-types', options),
  listMeasurementUnits: (options?: RequestBehaviorOptions) =>
    apiRequest<{ units: FarmerMeasurementUnitItem[]; actor: string }>('/farmer/measurement-units', options),
  listRewards: (options?: RequestBehaviorOptions) =>
    apiRequest<{ rewards: FarmerRewardItem[]; actor: string }>('/farmer/rewards', options),
  listRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ requests: FarmerRewardRequestItem[]; actor: string }>('/farmer/reward-requests', options),
  listSubmissions: (options?: RequestBehaviorOptions) =>
    apiRequest<{ submissions: FarmerSubmissionItem[] }>('/farmer/submissions', options),
  createSubmission: (payload: CreateSubmissionPayload) =>
    apiRequest('/farmer/submissions', { method: 'POST', body: JSON.stringify(payload) }),
  getPoints: (options?: RequestBehaviorOptions) =>
    apiRequest<{ available_points: number; ledger: unknown[] }>('/farmer/points', options),
  createRewardRequest: (payload: CreateRewardRequestPayload) =>
    apiRequest<{ message: string; request: FarmerRewardRequestItem }>('/farmer/reward-requests', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSubmission: (submissionId: string) =>
    apiRequest<{ message: string; result: { deleted_id: string; image_url: string | null } }>(`/farmer/submissions/${submissionId}`, { method: 'DELETE' }),
  cancelRewardRequest: (requestId: string) =>
    apiRequest<{ message: string; result: { request_id: string; request_status: string; available_points: number } }>(
      `/farmer/reward-requests/${requestId}/cancel`, { method: 'POST' }),
  getProfile: (options?: RequestBehaviorOptions) =>
    apiRequest<{ id: string; display_name: string | null; phone: string | null; province: string | null }>('/farmer/profile', options),
  updateProfile: (payload: { display_name?: string | null; phone?: string | null; province?: string | null }) =>
    apiRequest<{ id: string; display_name: string | null; phone: string | null; province: string | null }>('/farmer/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
};
