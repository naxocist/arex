from typing import Any

from app.core.errors import WorkflowError
from app.db.supabase import get_service_client
from app.models.workflow import RejectRewardRequest
from app.services._base import BaseService, _first_row


class WarehouseService(BaseService):
    def _enrich_reward_requests(self, requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not requests:
            return []

        reward_ids = [str(r["reward_id"]) for r in requests if r.get("reward_id")]
        rewards_by_id: dict[str, dict[str, Any]] = {}
        if reward_ids:
            for row in (
                self.client.table("rewards")
                .select("id, name_th, description_th, points_cost")
                .in_("id", reward_ids)
                .execute()
            ).data or []:
                if row.get("id"):
                    rewards_by_id[str(row["id"])] = row

        farmer_ids = list({str(r["farmer_profile_id"]) for r in requests if r.get("farmer_profile_id")})
        profiles_by_id: dict[str, dict[str, Any]] = {}
        if farmer_ids:
            for row in (
                self.client.table("profiles")
                .select("id, display_name, phone, province")
                .in_("id", farmer_ids)
                .execute()
            ).data or []:
                if row.get("id"):
                    profiles_by_id[str(row["id"])] = row

        return [
            {
                **item,
                "reward_name_th": rewards_by_id.get(str(item.get("reward_id") or ""), {}).get("name_th"),
                "reward_description_th": rewards_by_id.get(str(item.get("reward_id") or ""), {}).get("description_th"),
                "reward_points_cost": rewards_by_id.get(str(item.get("reward_id") or ""), {}).get("points_cost"),
                "farmer_display_name": profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {}).get("display_name"),
                "farmer_phone": profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {}).get("phone"),
                "farmer_province": profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {}).get("province"),
            }
            for item in requests
        ]

    def list_pending_reward_requests(self) -> list[dict[str, Any]]:
        try:
            rows = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng"
                )
                .eq("status", "requested")
                .order("requested_at", desc=False)
                .execute()
            ).data or []
            return self._enrich_reward_requests(rows)
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch pending reward requests: {exc}") from exc

    def list_answered_reward_requests(self) -> list[dict[str, Any]]:
        try:
            rows = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng, "
                    "warehouse_decision_at, rejection_reason"
                )
                .in_("status", ["approved", "rejected"])
                .order("requested_at", desc=True)
                .execute()
            ).data or []
            return self._enrich_reward_requests(rows)
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch answered reward requests: {exc}") from exc

    def approve_reward_request(self, request_id: str, warehouse_profile_id: str) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "approve_reward_request",
                    {"p_request_id": request_id, "p_warehouse_profile_id": warehouse_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to approve reward request: {exc}") from exc

    def reject_reward_request(
        self, request_id: str, warehouse_profile_id: str, payload: RejectRewardRequest
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "reject_reward_request",
                    {
                        "p_request_id": request_id,
                        "p_warehouse_profile_id": warehouse_profile_id,
                        "p_reason": payload.reason,
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to reject reward request: {exc}") from exc


def get_warehouse_service() -> WarehouseService:
    return WarehouseService(client=get_service_client())
