import { beginGlobalLoading, endGlobalLoading } from '@/app/_lib/loadingState';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000/api/v1';

const ACCESS_TOKEN_KEY = 'AREX_ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'AREX_REFRESH_TOKEN';
const AUTH_ROLE_KEY = 'AREX_AUTH_ROLE';
const DEFAULT_GET_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

const GET_RESPONSE_CACHE = new Map<string, CacheEntry>();
let authRefreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function hasLowLevelTransportMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('winerror') ||
    normalizedMessage.includes('non-blocking socket') ||
    normalizedMessage.includes('socket operation') ||
    normalizedMessage.includes('failed to fetch')
  );
}

function getGenericConnectivityMessage(): string {
  return 'ระบบเชื่อมต่อข้อมูลไม่สำเร็จชั่วคราว กรุณาลองใหม่อีกครั้ง';
}

function normalizeApiErrorMessage(status: number, message: string): string {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return getGenericConnectivityMessage();
  }

  if (hasLowLevelTransportMessage(trimmedMessage)) {
    return getGenericConnectivityMessage();
  }

  if (status >= 500 && trimmedMessage === 'Unexpected API error') {
    return getGenericConnectivityMessage();
  }

  return trimmedMessage;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function buildCacheKey(path: string, token: string | null): string {
  return `${token ?? 'anon'}::${path}`;
}

function getCachedResponse<T>(cacheKey: string): T | null {
  const entry = GET_RESPONSE_CACHE.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    GET_RESPONSE_CACHE.delete(cacheKey);
    return null;
  }

  return entry.data as T;
}

function setCachedResponse(cacheKey: string, data: unknown, ttlMs: number): void {
  if (ttlMs <= 0) {
    return;
  }

  GET_RESPONSE_CACHE.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    data,
  });
}

function clearApiResponseCache(): void {
  GET_RESPONSE_CACHE.clear();
}

export function clearApiCache(): void {
  clearApiResponseCache();
}

export interface RequestBehaviorOptions {
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  retryOnAuthError?: boolean;
  showGlobalLoading?: boolean;
}

export function setAuthSession(params: {
  accessToken: string;
  refreshToken?: string | null;
  role?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  clearApiResponseCache();
  localStorage.setItem(ACCESS_TOKEN_KEY, params.accessToken);
  if (params.refreshToken !== undefined) {
    if (params.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, params.refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }
  if (params.role !== undefined) {
    if (params.role) {
      localStorage.setItem(AUTH_ROLE_KEY, params.role);
    } else {
      localStorage.removeItem(AUTH_ROLE_KEY);
    }
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  clearApiResponseCache();
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
}

export function getStoredRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_ROLE_KEY);
}

function shouldRetryWithRefresh(error: ApiError): boolean {
  if (error.status === 401) {
    return true;
  }

  if (error.status !== 403) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('role not assigned') || message.includes('invalid token');
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return false;
  }

  if (authRefreshInFlight) {
    return authRefreshInFlight;
  }

  authRefreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const body = (await response.json()) as {
        access_token?: string | null;
        refresh_token?: string | null;
        user?: { role?: string | null };
      };

      if (!body?.access_token) {
        return false;
      }

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

async function parseResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const rawMessage =
      typeof body === 'string'
        ? body
        : body?.detail || body?.message || 'Unexpected API error';
    throw new ApiError(response.status, normalizeApiErrorMessage(response.status, rawMessage));
  }

  return body as T;
}

export type ApiRequestOptions = RequestInit & RequestBehaviorOptions;

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    forceRefresh = false,
    cacheTtlMs = DEFAULT_GET_CACHE_TTL_MS,
    retryOnAuthError = true,
    showGlobalLoading,
    ...requestOptions
  } = options;
  const token = getStoredToken();
  const method = (requestOptions.method || 'GET').toUpperCase();
  const isGetRequest = method === 'GET';
  const cacheKey = isGetRequest ? buildCacheKey(path, token) : null;
  const shouldShowGlobalLoading = showGlobalLoading ?? isGetRequest;

  if (isGetRequest && cacheKey && !forceRefresh) {
    const cached = getCachedResponse<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  if (isGetRequest && cacheKey && forceRefresh) {
    GET_RESPONSE_CACHE.delete(cacheKey);
  }

  const headers = new Headers(requestOptions.headers || {});

  if (!headers.has('Content-Type') && requestOptions.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (shouldShowGlobalLoading) {
    beginGlobalLoading();
  }

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestOptions,
        method,
        headers,
      });
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
            forceRefresh: isGetRequest ? true : forceRefresh,
            showGlobalLoading: false,
          });
        }
        clearAuthSession();
      }

      throw error;
    }

    if (isGetRequest && cacheKey) {
      setCachedResponse(cacheKey, parsed, cacheTtlMs);
    } else {
      clearApiResponseCache();
    }

    return parsed;
  } finally {
    if (shouldShowGlobalLoading) {
      endGlobalLoading();
    }
  }
}

export interface CreateSubmissionPayload {
  material_type: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
  pickup_lat: number;
  pickup_lng: number;
  notes?: string;
}

export interface FarmerMaterialTypeItem {
  code: string;
  name_th: string;
  active: boolean;
}

export interface FarmerMeasurementUnitItem {
  code: string;
  name_th: string;
  to_kg_factor: number | null;
  active: boolean;
}

export interface ExecutiveMaterialTypeItem {
  code: string;
  name_th: string;
  active: boolean;
}

export interface ExecutiveMeasurementUnitItem {
  code: string;
  name_th: string;
  to_kg_factor: number | null;
  active: boolean;
}

export interface ExecutiveMaterialPointRuleItem {
  material_type: string;
  material_name_th: string;
  material_active: boolean;
  points_per_kg: number | null;
}

export interface UpsertMaterialTypePayload {
  code: string;
  name_th: string;
  active: boolean;
}

export interface UpsertMeasurementUnitPayload {
  code: string;
  name_th: string;
  to_kg_factor: number | null;
  active: boolean;
}

export interface UpsertMaterialPointRulePayload {
  points_per_kg: number;
}

export interface ExecutiveSubmissionMaterialBreakdownItem {
  material_type: string;
  material_name_th?: string | null;
  submissions_count: number;
  declared_quantity_total: number;
  estimated_weight_kg_total: number;
  convertible_submissions_count: number;
  non_convertible_submissions_count: number;
}

export interface ExecutivePickupJobsStatusSummary {
  pickup_scheduled: number;
  picked_up: number;
  delivered_to_factory: number;
}

export interface ExecutiveRewardRequestStatusSummary {
  requested: number;
  warehouse_approved: number;
  warehouse_rejected: number;
  cancelled: number;
}

export interface ExecutiveOverview {
  submissions_total: number;
  unique_farmers_total: number;
  submissions_pending_pickup: number;
  pickup_jobs_active: number;
  pickup_jobs_status_summary: ExecutivePickupJobsStatusSummary;
  reward_requests_pending_warehouse: number;
  submitted_weight_estimated_kg_total: number;
  submitted_weight_estimated_ton_total: number;
  submissions_convertible_count: number;
  submissions_non_convertible_count: number;
  submissions_non_convertible_quantity_total: number;
  factory_confirmed_weight_kg_total: number;
  factory_confirmed_weight_ton_total: number;
  points_credited_total: number;
  points_reserved_total: number;
  points_spent_total: number;
  reward_requests_total: number;
  reward_requested_points_total: number;
  reward_approved_points_total: number;
  reward_requests_status_summary: ExecutiveRewardRequestStatusSummary;
  submissions_material_breakdown: ExecutiveSubmissionMaterialBreakdownItem[];
}

export interface FarmerSubmissionItem {
  id: string;
  material_type: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  status: string;
  created_at: string;
  pickup_window_start_at?: string | null;
  pickup_window_end_at?: string | null;
  pickup_job_status?: string | null;
}

export interface CreateRewardRequestPayload {
  reward_id: string;
  quantity: number;
  delivery_location_text?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
}

export interface FarmerRewardItem {
  id: string;
  name_th: string;
  description_th: string | null;
  points_cost: number;
  stock_qty: number;
  active: boolean;
  image_url: string | null;
}

export interface FarmerRewardDeliveryJobItem {
  id: string;
  status: 'reward_delivery_scheduled' | 'out_for_delivery' | 'reward_delivered' | string;
  planned_delivery_at: string | null;
  delivery_window_end_at?: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
}

export interface FarmerRewardRequestItem {
  id: string;
  reward_id: string;
  quantity: number;
  requested_points: number;
  status: 'requested' | 'warehouse_approved' | 'warehouse_rejected' | 'cancelled' | string;
  requested_at: string;
  warehouse_decision_at: string | null;
  rejection_reason: string | null;
  delivery_location_text: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  reward_delivery_jobs: FarmerRewardDeliveryJobItem[];
}

export interface SchedulePickupPayload {
  pickup_window_start_at: string;
  pickup_window_end_at: string;
  destination_factory_id: string;
  notes?: string;
}

export interface ImpactKpis {
  has_baseline: boolean;
  pilot_area: string | null;
  hotspot_count_baseline: number | null;
  co2_kg_baseline: number | null;
  avg_income_baht_per_household: number | null;
  recorded_by: string | null;
  recorded_at: string | null;
}

export interface ValueChainItem {
  id: string;
  product_name_th: string;
  producer_org: string | null;
  buyer_org: string | null;
  buyer_use_th: string | null;
  active: boolean;
}

export interface LogisticsFactoryOptionItem {
  id: string;
  name_th: string;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
  active: boolean;
  is_focal_point?: boolean;
}

export interface LogisticsPickupQueueItem {
  id: string;
  farmer_profile_id: string;
  material_type: 'rice_straw' | 'cassava_root' | 'sugarcane_bagasse' | 'corn_stover' | string;
  material_name_th?: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  status: 'submitted' | 'pickup_scheduled' | string;
  created_at: string;
}

export interface LogisticsPickupJobItem {
  id: string;
  submission_id: string;
  logistics_profile_id: string;
  destination_factory_id?: string | null;
  destination_factory_name_th?: string | null;
  destination_factory_location_text?: string | null;
  destination_factory_is_focal_point?: boolean;
  destination_factory_lat?: number | null;
  destination_factory_lng?: number | null;
  status: 'pickup_scheduled' | 'picked_up' | 'delivered_to_factory' | string;
  planned_pickup_at: string;
  pickup_window_end_at?: string | null;
  picked_up_at: string | null;
  delivered_factory_at: string | null;
  created_at: string;
  material_type: string;
  material_name_th?: string;
  quantity_value: number;
  quantity_unit: string;
  pickup_location_text: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  submission_status: string;
  farmer_display_name?: string | null;
  farmer_phone?: string | null;
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
  delivery_window_start_at: string;
  delivery_window_end_at: string;
  notes?: string;
}

export interface LogisticsApprovedRewardRequestItem {
  id: string;
  farmer_profile_id: string;
  reward_id: string;
  reward_name_th?: string | null;
  reward_description_th?: string | null;
  reward_points_cost?: number | null;
  pickup_location_text?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  quantity: number;
  requested_points: number;
  status: string;
  requested_at: string;
  farmer_display_name?: string | null;
  farmer_phone?: string | null;
}

export interface LogisticsRewardDeliveryJobItem {
  id: string;
  reward_request_id: string;
  logistics_profile_id: string;
  status: 'reward_delivery_scheduled' | 'out_for_delivery' | string;
  planned_delivery_at: string;
  delivery_window_end_at?: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string;
  farmer_profile_id: string;
  farmer_display_name?: string | null;
  farmer_phone?: string | null;
  reward_id: string | null;
  reward_name_th: string | null;
  pickup_location_text?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
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
  material_name_th?: string | null;
  quantity_value: number;
  quantity_unit: string;
  quantity_to_kg_factor?: number | null;
  pickup_location_text: string;
}

export interface FactoryConfirmedIntakeItem {
  intake_id: string;
  pickup_job_id: string;
  submission_id: string;
  material_type: string;
  material_name_th?: string | null;
  quantity_value: number;
  quantity_unit: string;
  measured_weight_kg: number;
  measured_weight_ton: number;
  pickup_location_text: string;
  confirmed_at: string;
  status: string;
  factory_profile_id: string;
  discrepancy_note: string | null;
}

export interface FactoryIntakeSummary {
  arrived_count: number;
  confirmed_count: number;
  arrived_estimated_weight_kg_total: number;
  arrived_convertible_count: number;
  arrived_non_convertible_count: number;
  arrived_non_convertible_quantity_total: number;
  confirmed_weight_kg_total: number;
  confirmed_weight_ton_total: number;
}

export interface FactoryInfoItem {
  id: string;
  factory_profile_id: string;
  name_th: string;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
  created_at: string;
}

export interface UpsertFactoryInfoPayload {
  name_th: string;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface LogisticsInfoItem {
  id: string;
  logistics_profile_id: string;
  name_th: string;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
  created_at: string;
}

export interface UpsertLogisticsInfoPayload {
  name_th: string;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface RejectRewardRequestPayload {
  reason?: string;
}

export interface WarehousePendingRequestItem {
  id: string;
  farmer_profile_id: string;
  reward_id: string;
  reward_name_th?: string | null;
  reward_description_th?: string | null;
  reward_points_cost?: number | null;
  quantity: number;
  requested_points: number;
  status: string;
  requested_at: string;
  delivery_location_text?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  farmer_display_name?: string | null;
  farmer_phone?: string | null;
  farmer_province?: string | null;
  rejection_reason?: string | null;
  warehouse_decision_at?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterBasePayload {
  email: string;
  password: string;
  display_name: string;
  phone: string;
  province: string;
}

export interface RegisterFarmerPayload extends RegisterBasePayload {}

export interface RegisterLogisticsPayload extends RegisterBasePayload {
  name_th: string;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface RegisterFactoryPayload extends RegisterBasePayload {
  name_th: string;
  location_text?: string | null;
  lat?: number | null;
  lng?: number | null;
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
      retryOnAuthError: false,
      showGlobalLoading: true,
    }),
  registerFarmer: (payload: RegisterFarmerPayload) =>
    apiRequest<LoginResponse>('/auth/register/farmer', {
      method: 'POST',
      body: JSON.stringify(payload),
      retryOnAuthError: false,
      showGlobalLoading: true,
    }),
  registerLogistics: (payload: RegisterLogisticsPayload) =>
    apiRequest<LoginResponse>('/auth/register/logistics', {
      method: 'POST',
      body: JSON.stringify(payload),
      retryOnAuthError: false,
      showGlobalLoading: true,
    }),
  registerFactory: (payload: RegisterFactoryPayload) =>
    apiRequest<LoginResponse>('/auth/register/factory', {
      method: 'POST',
      body: JSON.stringify(payload),
      retryOnAuthError: false,
      showGlobalLoading: true,
    }),
};

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
    apiRequest('/farmer/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPoints: (options?: RequestBehaviorOptions) =>
    apiRequest<{ available_points: number; ledger: unknown[] }>('/farmer/points', options),
  createRewardRequest: (payload: CreateRewardRequestPayload) =>
    apiRequest<{ message: string; request: FarmerRewardRequestItem }>('/farmer/reward-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelRewardRequest: (requestId: string) =>
    apiRequest<{ message: string; result: { request_id: string; request_status: string; available_points: number } }>(
      `/farmer/reward-requests/${requestId}/cancel`,
      {
        method: 'POST',
      },
    ),
  getProfile: (options?: RequestBehaviorOptions) =>
    apiRequest<{ id: string; display_name: string | null; phone: string | null; province: string | null }>('/farmer/profile', options),
  updateProfile: (payload: { display_name?: string | null; phone?: string | null; province?: string | null }) =>
    apiRequest<{ id: string; display_name: string | null; phone: string | null; province: string | null }>('/farmer/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const logisticsApi = {
  listFactories: (options?: RequestBehaviorOptions) =>
    apiRequest<{ factories: LogisticsFactoryOptionItem[]; actor: string }>('/logistics/factories', options),
  getPickupQueue: (options?: RequestBehaviorOptions) =>
    apiRequest<{ queue: LogisticsPickupQueueItem[]; actor: string }>('/logistics/pickup-queue', options),
  getPickupJobs: (options?: RequestBehaviorOptions) =>
    apiRequest<{ jobs: LogisticsPickupJobItem[]; actor: string }>('/logistics/pickup-jobs', options),
  getApprovedRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ queue: LogisticsApprovedRewardRequestItem[]; actor: string }>('/logistics/reward-requests/approved', options),
  getRewardDeliveryJobs: (options?: RequestBehaviorOptions) =>
    apiRequest<{ jobs: LogisticsRewardDeliveryJobItem[]; actor: string }>('/logistics/reward-delivery-jobs', options),
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
  getMyInfo: (options?: RequestBehaviorOptions) => apiRequest<LogisticsInfoItem>('/logistics/me', options),
  updateMyInfo: (payload: UpsertLogisticsInfoPayload) =>
    apiRequest<LogisticsInfoItem>('/logistics/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

export const factoryApi = {
  getMyFactory: (options?: RequestBehaviorOptions) => apiRequest<FactoryInfoItem>('/factory/me', options),
  updateMyFactory: (payload: UpsertFactoryInfoPayload) =>
    apiRequest<FactoryInfoItem>('/factory/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  listPendingIntakes: (options?: RequestBehaviorOptions) =>
    apiRequest<{
      queue: FactoryPendingIntakeItem[];
      confirmed: FactoryConfirmedIntakeItem[];
      summary: FactoryIntakeSummary;
      actor: string;
    }>('/factory/intakes/pending', options),
  confirmIntake: (payload: ConfirmFactoryIntakePayload) =>
    apiRequest('/factory/intakes/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const warehouseApi = {
  listPendingRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ requests: WarehousePendingRequestItem[]; actor: string }>('/warehouse/reward-requests/pending', options),
  listAnsweredRewardRequests: (options?: RequestBehaviorOptions) =>
    apiRequest<{ requests: WarehousePendingRequestItem[]; actor: string }>('/warehouse/reward-requests/answered', options),
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
  getOverview: (options?: RequestBehaviorOptions) =>
    apiRequest<{ overview: ExecutiveOverview; actor: string }>('/executive/dashboard/overview', options),
  listMaterialTypes: (options?: RequestBehaviorOptions) =>
    apiRequest<{ material_types: ExecutiveMaterialTypeItem[]; actor: string }>('/executive/material-types', options),
  createMaterialType: (payload: UpsertMaterialTypePayload) =>
    apiRequest<{ message: string; material_type: ExecutiveMaterialTypeItem; actor: string }>('/executive/material-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMaterialType: (materialCode: string, payload: UpsertMaterialTypePayload) =>
    apiRequest<{ message: string; material_type: ExecutiveMaterialTypeItem; actor: string }>(
      `/executive/material-types/${encodeURIComponent(materialCode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  listMeasurementUnits: (options?: RequestBehaviorOptions) =>
    apiRequest<{ units: ExecutiveMeasurementUnitItem[]; actor: string }>('/executive/measurement-units', options),
  createMeasurementUnit: (payload: UpsertMeasurementUnitPayload) =>
    apiRequest<{ message: string; unit: ExecutiveMeasurementUnitItem; actor: string }>('/executive/measurement-units', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMeasurementUnit: (unitCode: string, payload: UpsertMeasurementUnitPayload) =>
    apiRequest<{ message: string; unit: ExecutiveMeasurementUnitItem; actor: string }>(
      `/executive/measurement-units/${encodeURIComponent(unitCode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  listMaterialPointRules: (options?: RequestBehaviorOptions) =>
    apiRequest<{ rules: ExecutiveMaterialPointRuleItem[]; formula: string; actor: string }>(
      '/executive/material-point-rules',
      options,
    ),
  upsertMaterialPointRule: (materialCode: string, payload: UpsertMaterialPointRulePayload) =>
    apiRequest<{ message: string; rule: { material_type: string; points_per_kg: number }; actor: string }>(
      `/executive/material-point-rules/${encodeURIComponent(materialCode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  getImpactKpis: (options?: RequestBehaviorOptions) =>
    apiRequest<{ impact_kpis: ImpactKpis; actor: string }>('/executive/impact-kpis', options),
  listValueChain: (options?: RequestBehaviorOptions) =>
    apiRequest<{ value_chain: ValueChainItem[]; actor: string }>('/executive/value-chain', options),
  listRewards: (options?: RequestBehaviorOptions) =>
    apiRequest<{ rewards: FarmerRewardItem[]; actor: string }>('/executive/rewards', options),
  createReward: (payload: { name_th: string; description_th?: string; points_cost: number; stock_qty: number; active?: boolean }) =>
    apiRequest<{ message: string; reward: FarmerRewardItem; actor: string }>('/executive/rewards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateReward: (rewardId: string, payload: Partial<{ name_th: string; description_th: string; points_cost: number; stock_qty: number; active: boolean }>) =>
    apiRequest<{ message: string; reward: FarmerRewardItem; actor: string }>(`/executive/rewards/${encodeURIComponent(rewardId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
