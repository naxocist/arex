export interface LoginPayload { email: string; password: string }
export interface RegisterBasePayload { email: string; password: string; display_name: string; phone: string; province: string }
export interface RegisterFarmerPayload extends RegisterBasePayload {}
export interface RegisterLogisticsPayload extends RegisterBasePayload { name_th: string; location_text?: string | null; lat?: number | null; lng?: number | null }
export interface RegisterFactoryPayload extends RegisterBasePayload { name_th: string; location_text?: string | null; lat?: number | null; lng?: number | null }
export interface LoginResponse {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  approval_status?: string;
  user: { id: string; email: string | null; role: string };
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
export interface FarmerMaterialTypeItem { code: string; name_th: string; active: boolean }
export interface FarmerMeasurementUnitItem { code: string; name_th: string; to_kg_factor: number | null; active: boolean }
export interface FarmerRewardItem { id: string; name_th: string; description_th: string | null; points_cost: number; stock_qty: number; active: boolean; image_url: string | null }
export interface FarmerRewardDeliveryJobItem {
  id: string;
  status: 'reward_delivery_scheduled' | 'out_for_delivery' | 'reward_delivered' | string;
  planned_delivery_at: string | null;
  delivery_window_end_at?: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
}
export interface FarmerRewardRequestItem {
  id: string; reward_id: string; quantity: number; requested_points: number;
  status: 'requested' | 'warehouse_approved' | 'warehouse_rejected' | 'cancelled' | string;
  requested_at: string; warehouse_decision_at: string | null; rejection_reason: string | null;
  delivery_location_text: string | null; delivery_lat: number | null; delivery_lng: number | null;
  reward_delivery_jobs: FarmerRewardDeliveryJobItem[];
}
export interface FarmerSubmissionItem {
  id: string; material_type: string; quantity_value: number; quantity_unit: string;
  pickup_location_text: string; pickup_lat?: number | null; pickup_lng?: number | null;
  status: string; created_at: string; pickup_window_start_at?: string | null; pickup_window_end_at?: string | null;
  pickup_job_status?: string | null;
}
export interface CreateRewardRequestPayload { reward_id: string; quantity: number; delivery_location_text?: string | null; delivery_lat?: number | null; delivery_lng?: number | null }

export interface ExecutiveMaterialTypeItem { code: string; name_th: string; active: boolean }
export interface ExecutiveMeasurementUnitItem { code: string; name_th: string; to_kg_factor: number | null; active: boolean }
export interface ExecutiveMaterialPointRuleItem { material_type: string; material_name_th: string; material_active: boolean; points_per_kg: number | null }
export interface UpsertMaterialTypePayload { code: string; name_th: string; active: boolean }
export interface UpsertMeasurementUnitPayload { code: string; name_th: string; to_kg_factor: number | null; active: boolean }
export interface UpsertMaterialPointRulePayload { points_per_kg: number }
export interface ExecutiveSubmissionMaterialBreakdownItem {
  material_type: string; material_name_th?: string | null; submissions_count: number;
  declared_quantity_total: number; estimated_weight_kg_total: number;
  convertible_submissions_count: number; non_convertible_submissions_count: number;
}
export interface ExecutivePickupJobsStatusSummary { pickup_scheduled: number; picked_up: number; delivered_to_factory: number }
export interface ExecutiveRewardRequestStatusSummary { requested: number; warehouse_approved: number; warehouse_rejected: number; cancelled: number }
export interface ExecutiveOverview {
  submissions_total: number; unique_farmers_total: number; submissions_pending_pickup: number;
  pickup_jobs_active: number; pickup_jobs_status_summary: ExecutivePickupJobsStatusSummary;
  reward_requests_pending_warehouse: number; submitted_weight_estimated_kg_total: number;
  submitted_weight_estimated_ton_total: number; submissions_convertible_count: number;
  submissions_non_convertible_count: number; submissions_non_convertible_quantity_total: number;
  factory_confirmed_weight_kg_total: number; factory_confirmed_weight_ton_total: number;
  points_credited_total: number; points_reserved_total: number; points_spent_total: number;
  reward_requests_total: number; reward_requested_points_total: number; reward_approved_points_total: number;
  reward_requests_status_summary: ExecutiveRewardRequestStatusSummary;
  submissions_material_breakdown: ExecutiveSubmissionMaterialBreakdownItem[];
}
export interface ImpactKpis { has_baseline: boolean; pilot_area: string | null; hotspot_count_baseline: number | null; co2_kg_baseline: number | null; avg_income_baht_per_household: number | null; recorded_by: string | null; recorded_at: string | null }
export interface ValueChainItem { id: string; product_name_th: string; producer_org: string | null; buyer_org: string | null; buyer_use_th: string | null; active: boolean }

export interface SchedulePickupPayload { pickup_window_start_at: string; pickup_window_end_at: string; destination_factory_id: string; notes?: string }
export interface SchedulePickupResponse { message: string; result: { pickup_job_id: string; submission_status: string; pickup_status: string } }
export interface LogisticsFactoryOptionItem { id: string; name_th: string; location_text?: string | null; lat?: number | null; lng?: number | null; active: boolean; is_focal_point?: boolean }
export interface LogisticsPickupQueueItem {
  id: string; farmer_profile_id: string;
  material_type: 'rice_straw' | 'cassava_root' | 'sugarcane_bagasse' | 'corn_stover' | string;
  material_name_th?: string; quantity_value: number; quantity_unit: string;
  pickup_location_text: string; pickup_lat?: number | null; pickup_lng?: number | null;
  status: 'submitted' | 'pickup_scheduled' | string; created_at: string;
}
export interface LogisticsPickupJobItem {
  id: string; submission_id: string; logistics_profile_id: string;
  destination_factory_id?: string | null; destination_factory_name_th?: string | null;
  destination_factory_location_text?: string | null; destination_factory_is_focal_point?: boolean;
  destination_factory_lat?: number | null; destination_factory_lng?: number | null;
  status: 'pickup_scheduled' | 'picked_up' | 'delivered_to_factory' | string;
  planned_pickup_at: string; pickup_window_end_at?: string | null;
  picked_up_at: string | null; delivered_factory_at: string | null; created_at: string;
  material_type: string; material_name_th?: string; quantity_value: number; quantity_unit: string;
  pickup_location_text: string; pickup_lat?: number | null; pickup_lng?: number | null;
  submission_status: string; farmer_display_name?: string | null; farmer_phone?: string | null;
}
export interface ScheduleRewardDeliveryPayload { delivery_window_start_at: string; delivery_window_end_at: string; notes?: string }
export interface ScheduleRewardDeliveryResponse { message: string; result: { delivery_job_id: string; delivery_status: string } }
export interface LogisticsApprovedRewardRequestItem {
  id: string; farmer_profile_id: string; reward_id: string; reward_name_th?: string | null;
  reward_description_th?: string | null; reward_points_cost?: number | null;
  pickup_location_text?: string | null; pickup_lat?: number | null; pickup_lng?: number | null;
  quantity: number; requested_points: number; status: string; requested_at: string;
  farmer_display_name?: string | null; farmer_phone?: string | null;
}
export interface LogisticsRewardDeliveryJobItem {
  id: string; reward_request_id: string; logistics_profile_id: string;
  status: 'reward_delivery_scheduled' | 'out_for_delivery' | string;
  planned_delivery_at: string; delivery_window_end_at?: string | null;
  out_for_delivery_at: string | null; delivered_at: string | null; created_at: string;
  farmer_profile_id: string; farmer_display_name?: string | null; farmer_phone?: string | null;
  reward_id: string | null; reward_name_th: string | null;
  pickup_location_text?: string | null; pickup_lat?: number | null; pickup_lng?: number | null;
  quantity: number; requested_points: number;
}

export interface ConfirmFactoryIntakePayload { pickup_job_id: string; measured_weight_kg: number; discrepancy_note?: string }
export interface FactoryPendingIntakeItem {
  pickup_job_id: string; submission_id: string; logistics_profile_id: string; status: string;
  planned_pickup_at: string; picked_up_at: string | null; delivered_factory_at: string | null;
  material_type: string; material_name_th?: string | null; quantity_value: number;
  quantity_unit: string; quantity_to_kg_factor?: number | null; pickup_location_text: string;
}
export interface FactoryConfirmedIntakeItem {
  intake_id: string; pickup_job_id: string; submission_id: string; material_type: string;
  material_name_th?: string | null; quantity_value: number; quantity_unit: string;
  measured_weight_kg: number; measured_weight_ton: number; pickup_location_text: string;
  confirmed_at: string; status: string; factory_profile_id: string; discrepancy_note: string | null;
}
export interface FactoryIntakeSummary {
  arrived_count: number; confirmed_count: number; arrived_estimated_weight_kg_total: number;
  arrived_convertible_count: number; arrived_non_convertible_count: number;
  arrived_non_convertible_quantity_total: number; confirmed_weight_kg_total: number; confirmed_weight_ton_total: number;
}
export interface FactoryInfoItem { id: string; factory_profile_id: string; name_th: string; location_text: string | null; lat: number | null; lng: number | null; active: boolean; created_at: string }
export interface UpsertFactoryInfoPayload { name_th: string; location_text?: string | null; lat?: number | null; lng?: number | null }
export interface LogisticsInfoItem { id: string; logistics_profile_id: string; name_th: string; location_text: string | null; lat: number | null; lng: number | null; active: boolean; created_at: string }
export interface UpsertLogisticsInfoPayload { name_th: string; location_text?: string | null; lat?: number | null; lng?: number | null }

export interface RejectRewardRequestPayload { reason?: string }
export interface WarehousePendingRequestItem {
  id: string; farmer_profile_id: string; reward_id: string; reward_name_th?: string | null;
  reward_description_th?: string | null; reward_points_cost?: number | null;
  quantity: number; requested_points: number; status: string; requested_at: string;
  delivery_location_text?: string | null; delivery_lat?: number | null; delivery_lng?: number | null;
  farmer_display_name?: string | null; farmer_phone?: string | null; farmer_province?: string | null;
  rejection_reason?: string | null; warehouse_decision_at?: string | null;
}

export interface AdminProfile { id: string; display_name: string; email: string; role: string; phone: string; province: string; approval_status: 'pending' | 'approved' | 'rejected'; approval_note: string | null; created_at: string }
export interface AdminSettings { approval_required_roles: string[] }
export interface AdminOverview { pending_approvals: Record<string, number>; pending_total: number; overview: ExecutiveOverview }
