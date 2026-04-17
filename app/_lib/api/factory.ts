import { apiRequest, type RequestBehaviorOptions } from './core';
import type { FactoryInfoItem, UpsertFactoryInfoPayload, FactoryPendingIntakeItem, FactoryConfirmedIntakeItem, FactoryIntakeSummary, ConfirmFactoryIntakePayload } from './types';

export const factoryApi = {
  getMyFactory: (options?: RequestBehaviorOptions) =>
    apiRequest<FactoryInfoItem>('/factory/me', options),
  updateMyFactory: (payload: UpsertFactoryInfoPayload) =>
    apiRequest<FactoryInfoItem>('/factory/me', { method: 'PUT', body: JSON.stringify(payload) }),
  listPendingIntakes: (options?: RequestBehaviorOptions) =>
    apiRequest<{ queue: FactoryPendingIntakeItem[]; confirmed: FactoryConfirmedIntakeItem[]; summary: FactoryIntakeSummary; actor: string }>('/factory/intakes/pending', options),
  confirmIntake: (payload: ConfirmFactoryIntakePayload) =>
    apiRequest('/factory/intakes/confirm', { method: 'POST', body: JSON.stringify(payload) }),
};
