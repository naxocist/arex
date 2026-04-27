from typing import Any

from app.core.errors import WorkflowError
from app.db.supabase import get_service_client
from app.services._base import BaseService
from app.services.catalog_service import CatalogService
from app.services.rewards_service import RewardsService


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class ExecutiveService(BaseService):
    def get_executive_overview(self) -> dict[str, Any]:
        try:
            submissions = (
                self.client.table("material_submissions")
                .select("id, farmer_profile_id, material_type, quantity_value, quantity_unit, status, measured_weight_kg")
                .execute()
            ).data or []
            reward_requests = (
                self.client.table("reward_requests")
                .select("id, status, requested_points")
                .execute()
            ).data or []
            points_ledger = (
                self.client.table("points_ledger").select("entry_type, points_amount").execute()
            ).data or []
            units = (
                self.client.table("measurement_units").select("code, to_kg_factor").execute()
            ).data or []
            material_types = (
                self.client.table("material_types").select("code, name_th").execute()
            ).data or []

            units_to_kg_factor = {
                str(row.get("code")): _to_float(row.get("to_kg_factor"))
                for row in units
                if row.get("code") is not None and row.get("to_kg_factor") is not None
            }
            material_name_by_code = {
                str(row.get("code")): str(row.get("name_th"))
                for row in material_types
                if row.get("code") is not None and row.get("name_th") is not None
            }

            submissions_by_material: dict[str, dict[str, Any]] = {}
            submitted_weight_estimated_kg_total = 0.0
            submissions_convertible_count = 0
            submissions_non_convertible_count = 0
            submissions_non_convertible_quantity_total = 0.0
            submissions_pending_pickup = 0
            unique_farmers: set[str] = set()

            for row in submissions:
                if row.get("status") == "submitted":
                    submissions_pending_pickup += 1
                if row.get("farmer_profile_id") is not None:
                    unique_farmers.add(str(row["farmer_profile_id"]))

                material_code = str(row.get("material_type") or "unknown")
                quantity_value = _to_float(row.get("quantity_value"))
                quantity_unit = str(row.get("quantity_unit") or "")
                unit_factor = units_to_kg_factor.get(quantity_unit)
                is_convertible = unit_factor is not None and unit_factor > 0
                estimated_kg = quantity_value * unit_factor if is_convertible else 0.0
                submitted_weight_estimated_kg_total += estimated_kg

                if is_convertible:
                    submissions_convertible_count += 1
                else:
                    submissions_non_convertible_count += 1
                    submissions_non_convertible_quantity_total += quantity_value

                stat = submissions_by_material.setdefault(material_code, {
                    "material_type": material_code,
                    "material_name_th": material_name_by_code.get(material_code),
                    "submissions_count": 0,
                    "declared_quantity_total": 0.0,
                    "estimated_weight_kg_total": 0.0,
                    "convertible_submissions_count": 0,
                    "non_convertible_submissions_count": 0,
                })
                stat["submissions_count"] += 1
                stat["declared_quantity_total"] += quantity_value
                stat["estimated_weight_kg_total"] += estimated_kg
                if is_convertible:
                    stat["convertible_submissions_count"] += 1
                else:
                    stat["non_convertible_submissions_count"] += 1

            submissions_material_breakdown = sorted(
                submissions_by_material.values(),
                key=lambda r: r["submissions_count"],
                reverse=True,
            )

            rr_status: dict[str, int] = {}
            reward_requested_points_total = 0
            reward_approved_points_total = 0
            for r in reward_requests:
                st = r.get("status") or ""
                rr_status[st] = rr_status.get(st, 0) + 1
                pts = int(_to_float(r.get("requested_points")))
                reward_requested_points_total += pts
                if st == "approved":
                    reward_approved_points_total += pts
            reward_requests_status_summary = {
                "requested": rr_status.get("requested", 0),
                "approved": rr_status.get("approved", 0),
                "rejected": rr_status.get("rejected", 0),
                "cancelled": rr_status.get("cancelled", 0),
            }

            points_credited_total = 0
            points_spent_total = 0
            points_reserved_total = 0
            for r in points_ledger:
                entry_type = r.get("entry_type") or ""
                amt = int(_to_float(r.get("points_amount")))
                if entry_type in {"intake_credit", "adjustment"}:
                    points_credited_total += amt
                elif entry_type == "reward_spend":
                    points_spent_total += amt
                elif entry_type == "reward_reserve":
                    points_reserved_total += amt
                elif entry_type == "reward_release":
                    points_reserved_total -= amt

            ms_status: dict[str, int] = {}
            factory_confirmed_weight_kg_total = 0.0
            for r in submissions:
                st = r.get("status") or ""
                ms_status[st] = ms_status.get(st, 0) + 1
                if st == "done":
                    factory_confirmed_weight_kg_total += _to_float(r.get("measured_weight_kg"))

            pickup_jobs_status_summary = {
                "pickup_scheduled": ms_status.get("pickup_scheduled", 0),
                "received": ms_status.get("received", 0),
                "delivered": ms_status.get("delivered", 0),
            }

            return {
                "submissions_total": len(submissions),
                "unique_farmers_total": len(unique_farmers),
                "submissions_pending_pickup": submissions_pending_pickup,
                "pickup_jobs_active": sum(ms_status.get(s, 0) for s in {"pickup_scheduled", "received", "delivered"}),
                "pickup_jobs_status_summary": pickup_jobs_status_summary,
                "reward_requests_pending_warehouse": rr_status.get("requested", 0),
                "submitted_weight_estimated_kg_total": round(submitted_weight_estimated_kg_total, 3),
                "submitted_weight_estimated_ton_total": round(submitted_weight_estimated_kg_total / 1000, 3),
                "submissions_convertible_count": submissions_convertible_count,
                "submissions_non_convertible_count": submissions_non_convertible_count,
                "submissions_non_convertible_quantity_total": round(submissions_non_convertible_quantity_total, 3),
                "factory_confirmed_weight_kg_total": round(factory_confirmed_weight_kg_total, 3),
                "factory_confirmed_weight_ton_total": round(factory_confirmed_weight_kg_total / 1000, 3),
                "points_credited_total": points_credited_total,
                "points_reserved_total": max(points_reserved_total, 0),
                "points_spent_total": points_spent_total,
                "reward_requests_total": len(reward_requests),
                "reward_requested_points_total": reward_requested_points_total,
                "reward_approved_points_total": reward_approved_points_total,
                "reward_requests_status_summary": reward_requests_status_summary,
                "submissions_material_breakdown": submissions_material_breakdown,
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch executive overview: {exc}") from exc

    def get_impact_kpis(self) -> dict[str, Any]:
        try:
            rows = (
                self.client.table("impact_baselines")
                .select(
                    "pilot_area, hotspot_count_baseline, co2_kg_baseline, "
                    "avg_income_baht_per_household, recorded_by, recorded_at"
                )
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            ).data or []
            baseline = rows[0] if rows else None
            return {
                "has_baseline": baseline is not None,
                "pilot_area": baseline.get("pilot_area") if baseline else None,
                "hotspot_count_baseline": baseline.get("hotspot_count_baseline") if baseline else None,
                "co2_kg_baseline": baseline.get("co2_kg_baseline") if baseline else None,
                "avg_income_baht_per_household": baseline.get("avg_income_baht_per_household") if baseline else None,
                "recorded_by": baseline.get("recorded_by") if baseline else None,
                "recorded_at": baseline.get("recorded_at") if baseline else None,
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch impact KPIs: {exc}") from exc

    def list_value_chain(self) -> list[dict[str, Any]]:
        try:
            return (
                self.client.table("value_chain_mappings")
                .select("id, product_name_th, producer_org, buyer_org, buyer_use_th, active")
                .eq("active", True)
                .order("created_at", desc=False)
                .execute()
            ).data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch value chain: {exc}") from exc


class ExecutiveDomainService(ExecutiveService, CatalogService, RewardsService):
    pass


def get_executive_domain_service() -> ExecutiveDomainService:
    return ExecutiveDomainService(client=get_service_client())
