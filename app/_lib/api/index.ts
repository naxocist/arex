export { API_BASE_URL, ApiError, apiRequest, clearApiCache } from './core';
export type { RequestBehaviorOptions, ApiRequestOptions } from './core';

export {
  registerAuthFailureHandler,
  setAuthSession,
  clearAuthSession,
  getStoredRole,
  getStoredApprovalStatus,
  hasAccessToken,
} from './auth-session';

export * from './types';
export { authApi } from './auth';
export { farmerApi } from './farmer';
export { logisticsApi } from './logistics';
export { factoryApi } from './factory';
export { warehouseApi } from './warehouse';
export { executiveApi } from './executive';
export { adminApi } from './admin';
export { uploadRewardImage, deleteRewardImage } from './storage';
