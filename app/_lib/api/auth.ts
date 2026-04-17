import { apiRequest } from './core';
import type { LoginPayload, LoginResponse, RegisterFarmerPayload, RegisterLogisticsPayload, RegisterFactoryPayload } from './types';

export const authApi = {
  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload), retryOnAuthError: false, showGlobalLoading: true }),
  registerFarmer: (payload: RegisterFarmerPayload) =>
    apiRequest<LoginResponse>('/auth/register/farmer', { method: 'POST', body: JSON.stringify(payload), retryOnAuthError: false, showGlobalLoading: true }),
  registerLogistics: (payload: RegisterLogisticsPayload) =>
    apiRequest<LoginResponse>('/auth/register/logistics', { method: 'POST', body: JSON.stringify(payload), retryOnAuthError: false, showGlobalLoading: true }),
  registerFactory: (payload: RegisterFactoryPayload) =>
    apiRequest<LoginResponse>('/auth/register/factory', { method: 'POST', body: JSON.stringify(payload), retryOnAuthError: false, showGlobalLoading: true }),
};
