export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8000/api/v1';

const ACCESS_TOKEN_KEY = 'AREX_ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'AREX_REFRESH_TOKEN';
const AUTH_ROLE_KEY = 'AREX_AUTH_ROLE';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAuthSession(params: {
  accessToken: string;
  refreshToken?: string | null;
  role?: string | null;
}): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, params.accessToken);
  if (params.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, params.refreshToken);
  }
  if (params.role) {
    localStorage.setItem(AUTH_ROLE_KEY, params.role);
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
}

export function getStoredRole(): string | null {
  return localStorage.getItem(AUTH_ROLE_KEY);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'string'
        ? body
        : body?.detail || body?.message || 'Unexpected API error';
    throw new ApiError(response.status, message);
  }

  return body as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return parseResponse<T>(response);
}

export interface CreateSubmissionPayload {
  material_type: 'rice_straw' | 'cassava_root' | 'sugarcane_bagasse' | 'corn_stover';
  quantity_value: number;
  quantity_unit: 'kg' | 'ton' | 'm3';
  pickup_location_text: string;
  notes?: string;
}

export interface FarmerSubmissionItem {
  id: string;
  material_type: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
  status: string;
  created_at: string;
}

export interface CreateRewardRequestPayload {
  reward_id: string;
  quantity: number;
}

export interface FarmerRewardItem {
  id: string;
  name_th: string;
  description_th: string | null;
  points_cost: number;
  stock_qty: number;
  active: boolean;
}

export interface FarmerRewardDeliveryJobItem {
  id: string;
  status: 'reward_delivery_scheduled' | 'out_for_delivery' | 'reward_delivered' | string;
  planned_delivery_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
}

export interface FarmerRewardRequestItem {
  id: string;
  reward_id: string;
  quantity: number;
  requested_points: number;
  status: 'requested' | 'warehouse_approved' | 'warehouse_rejected' | string;
  requested_at: string;
  warehouse_decision_at: string | null;
  rejection_reason: string | null;
  reward_delivery_jobs: FarmerRewardDeliveryJobItem[];
}

export interface SchedulePickupPayload {
  planned_pickup_at: string;
  notes?: string;
}

export interface LogisticsPickupQueueItem {
  id: string;
  farmer_profile_id: string;
  material_type: 'rice_straw' | 'cassava_root' | 'sugarcane_bagasse' | 'corn_stover' | string;
  quantity_value: number;
  quantity_unit: 'kg' | 'ton' | 'm3' | string;
  pickup_location_text: string;
  status: 'submitted' | 'pickup_scheduled' | string;
  created_at: string;
}

export interface LogisticsPickupJobItem {
  id: string;
  submission_id: string;
  logistics_profile_id: string;
  status: 'pickup_scheduled' | 'picked_up' | 'delivered_to_factory' | string;
  planned_pickup_at: string;
  picked_up_at: string | null;
  delivered_factory_at: string | null;
  created_at: string;
  material_type: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
  submission_status: string;
}

export interface SchedulePickupResponse {
  message: string;
  result: {
    pickup_job_id: string;
    submission_status: string;
    pickup_status: string;
  };
}

export interface ScheduleRewardDeliveryPayload {
  planned_delivery_at: string;
  notes?: string;
}

export interface LogisticsApprovedRewardRequestItem {
  id: string;
  farmer_profile_id: string;
  reward_id: string;
  quantity: number;
  requested_points: number;
  status: string;
  requested_at: string;
}

export interface LogisticsRewardDeliveryJobItem {
  id: string;
  reward_request_id: string;
  logistics_profile_id: string;
  status: 'reward_delivery_scheduled' | 'out_for_delivery' | string;
  planned_delivery_at: string;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string;
  farmer_profile_id: string;
  reward_id: string | null;
  reward_name_th: string | null;
  quantity: number;
  requested_points: number;
}

export interface ScheduleRewardDeliveryResponse {
  message: string;
  result: {
    delivery_job_id: string;
    delivery_status: string;
  };
}

export interface ConfirmFactoryIntakePayload {
  pickup_job_id: string;
  measured_weight_kg: number;
  discrepancy_note?: string;
}

export interface FactoryPendingIntakeItem {
  pickup_job_id: string;
  submission_id: string;
  logistics_profile_id: string;
  status: string;
  planned_pickup_at: string;
  picked_up_at: string | null;
  delivered_factory_at: string | null;
  material_type: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
}

export interface RejectRewardRequestPayload {
  reason: string;
}

export interface WarehousePendingRequestItem {
  id: string;
  farmer_profile_id: string;
  reward_id: string;
  quantity: number;
  requested_points: number;
  status: string;
  requested_at: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  user: {
    id: string;
    email: string | null;
    role: string;
  };
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const farmerApi = {
  getMe: () => apiRequest<{ user_id: string; email: string | null; role: string }>('/farmer/me'),
  listRewards: () => apiRequest<{ rewards: FarmerRewardItem[]; actor: string }>('/farmer/rewards'),
  listRewardRequests: () => apiRequest<{ requests: FarmerRewardRequestItem[]; actor: string }>('/farmer/reward-requests'),
  listSubmissions: () => apiRequest<{ submissions: FarmerSubmissionItem[] }>('/farmer/submissions'),
  createSubmission: (payload: CreateSubmissionPayload) =>
    apiRequest('/farmer/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPoints: () => apiRequest<{ available_points: number; ledger: unknown[] }>('/farmer/points'),
  createRewardRequest: (payload: CreateRewardRequestPayload) =>
    apiRequest<{ message: string; request: FarmerRewardRequestItem }>('/farmer/reward-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const logisticsApi = {
  getPickupQueue: () => apiRequest<{ queue: LogisticsPickupQueueItem[]; actor: string }>('/logistics/pickup-queue'),
  getPickupJobs: () => apiRequest<{ jobs: LogisticsPickupJobItem[]; actor: string }>('/logistics/pickup-jobs'),
  getApprovedRewardRequests: () =>
    apiRequest<{ queue: LogisticsApprovedRewardRequestItem[]; actor: string }>('/logistics/reward-requests/approved'),
  getRewardDeliveryJobs: () =>
    apiRequest<{ jobs: LogisticsRewardDeliveryJobItem[]; actor: string }>('/logistics/reward-delivery-jobs'),
  schedulePickup: (submissionId: string, payload: SchedulePickupPayload) =>
    apiRequest<SchedulePickupResponse>(`/logistics/pickup-jobs/${submissionId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markPickedUp: (pickupJobId: string) =>
    apiRequest(`/logistics/pickup-jobs/${pickupJobId}/picked-up`, {
      method: 'POST',
    }),
  markDeliveredToFactory: (pickupJobId: string) =>
    apiRequest(`/logistics/pickup-jobs/${pickupJobId}/delivered-to-factory`, {
      method: 'POST',
    }),
  scheduleRewardDelivery: (requestId: string, payload: ScheduleRewardDeliveryPayload) =>
    apiRequest<ScheduleRewardDeliveryResponse>(`/logistics/reward-delivery-jobs/${requestId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markRewardOutForDelivery: (deliveryJobId: string) =>
    apiRequest(`/logistics/reward-delivery-jobs/${deliveryJobId}/out-for-delivery`, {
      method: 'POST',
    }),
  markRewardDelivered: (deliveryJobId: string) =>
    apiRequest(`/logistics/reward-delivery-jobs/${deliveryJobId}/delivered`, {
      method: 'POST',
    }),
};

export const factoryApi = {
  listPendingIntakes: () =>
    apiRequest<{ queue: FactoryPendingIntakeItem[]; actor: string }>('/factory/intakes/pending'),
  confirmIntake: (payload: ConfirmFactoryIntakePayload) =>
    apiRequest('/factory/intakes/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const warehouseApi = {
  listPendingRewardRequests: () =>
    apiRequest<{ requests: WarehousePendingRequestItem[]; actor: string }>('/warehouse/reward-requests/pending'),
  approveRewardRequest: (requestId: string) =>
    apiRequest<{ message: string; result: unknown }>(`/warehouse/reward-requests/${requestId}/approve`, {
      method: 'POST',
    }),
  rejectRewardRequest: (requestId: string, payload: RejectRewardRequestPayload) =>
    apiRequest<{ message: string; result: unknown }>(`/warehouse/reward-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const executiveApi = {
  getOverview: () => apiRequest<{ overview: Record<string, number>; actor: string }>('/executive/dashboard/overview'),
};
