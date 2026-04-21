import { apiRequest, type RequestBehaviorOptions } from './core';
import type { FactoryInfoItem, UpsertFactoryInfoPayload, FactoryPendingIntakeItem, FactoryConfirmedIntakeItem, FactoryIntakeSummary, ConfirmFactoryIntakePayload, FactoryMaterialPreferenceItem, FactoryMeasurementUnitOption, UpsertFactoryMaterialPreferencePayload } from './types';

export const factoryApi = {
  getMyFactory: (options?: RequestBehaviorOptions) =>
    apiRequest<FactoryInfoItem>('/factory/me', options),
  updateMyFactory: (payload: UpsertFactoryInfoPayload) =>
    apiRequest<FactoryInfoItem>('/factory/me', { method: 'PUT', body: JSON.stringify(payload) }),
  listPendingIntakes: (options?: RequestBehaviorOptions) =>
    apiRequest<{ queue: FactoryPendingIntakeItem[]; confirmed: FactoryConfirmedIntakeItem[]; summary: FactoryIntakeSummary; actor: string }>('/factory/intakes/pending', options),
  confirmIntake: (payload: ConfirmFactoryIntakePayload) =>
    apiRequest('/factory/intakes/confirm', { method: 'POST', body: JSON.stringify(payload) }),
  listMaterialPreferences: (options?: RequestBehaviorOptions) =>
    apiRequest<{ preferences: FactoryMaterialPreferenceItem[]; units: FactoryMeasurementUnitOption[]; actor: string }>('/factory/material-preferences', options),
  updateMaterialPreferences: (items: UpsertFactoryMaterialPreferencePayload[]) =>
    apiRequest<{ message: string; updated: number }>('/factory/material-preferences', { method: 'PUT', body: JSON.stringify({ items }) }),
};
