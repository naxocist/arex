import { apiRequest, type RequestBehaviorOptions } from './core';
import type { ExecutiveOverview, ExecutiveMaterialTypeItem, ExecutiveMeasurementUnitItem, UpsertMaterialTypePayload, UpsertMeasurementUnitPayload, ImpactKpis, ValueChainItem, FarmerRewardItem } from './types';

export const executiveApi = {
  getOverview: (options?: RequestBehaviorOptions) =>
    apiRequest<{ overview: ExecutiveOverview; actor: string }>('/executive/dashboard/overview', options),
  listMaterialTypes: (options?: RequestBehaviorOptions) =>
    apiRequest<{ material_types: ExecutiveMaterialTypeItem[]; actor: string }>('/executive/material-types', options),
  createMaterialType: (payload: UpsertMaterialTypePayload) =>
    apiRequest<{ message: string; material_type: ExecutiveMaterialTypeItem; actor: string }>('/executive/material-types', { method: 'POST', body: JSON.stringify(payload) }),
  updateMaterialType: (materialCode: string, payload: UpsertMaterialTypePayload) =>
    apiRequest<{ message: string; material_type: ExecutiveMaterialTypeItem; actor: string }>(`/executive/material-types/${encodeURIComponent(materialCode)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  listMeasurementUnits: (options?: RequestBehaviorOptions) =>
    apiRequest<{ units: ExecutiveMeasurementUnitItem[]; actor: string }>('/executive/measurement-units', options),
  createMeasurementUnit: (payload: UpsertMeasurementUnitPayload) =>
    apiRequest<{ message: string; unit: ExecutiveMeasurementUnitItem; actor: string }>('/executive/measurement-units', { method: 'POST', body: JSON.stringify(payload) }),
  updateMeasurementUnit: (unitCode: string, payload: UpsertMeasurementUnitPayload) =>
    apiRequest<{ message: string; unit: ExecutiveMeasurementUnitItem; actor: string }>(`/executive/measurement-units/${encodeURIComponent(unitCode)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getImpactKpis: (options?: RequestBehaviorOptions) =>
    apiRequest<{ impact_kpis: ImpactKpis; actor: string }>('/executive/impact-kpis', options),
  listValueChain: (options?: RequestBehaviorOptions) =>
    apiRequest<{ value_chain: ValueChainItem[]; actor: string }>('/executive/value-chain', options),
  listRewards: (options?: RequestBehaviorOptions) =>
    apiRequest<{ rewards: FarmerRewardItem[]; actor: string }>('/executive/rewards', options),
  createReward: (payload: { name_th: string; description_th?: string; points_cost: number; stock_qty: number; active?: boolean; image_url?: string | null }) =>
    apiRequest<{ message: string; reward: FarmerRewardItem; actor: string }>('/executive/rewards', { method: 'POST', body: JSON.stringify(payload) }),
  updateReward: (rewardId: string, payload: Partial<{ name_th: string; description_th: string; points_cost: number; stock_qty: number; active: boolean; image_url: string | null }>) =>
    apiRequest<{ message: string; reward: FarmerRewardItem; actor: string }>(`/executive/rewards/${encodeURIComponent(rewardId)}`, { method: 'PUT', body: JSON.stringify(payload) }),
};
