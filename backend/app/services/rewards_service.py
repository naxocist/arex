from typing import Any

from app.core.errors import WorkflowError
from app.services._base import BaseService, _first_row


class RewardsService(BaseService):
    def list_rewards(self) -> list[dict[str, Any]]:
        try:
            return (
                self.client.table("rewards")
                .select("id, name_th, description_th, points_cost, stock_qty, active, image_url")
                .eq("active", True)
                .gt("stock_qty", 0)
                .order("points_cost", desc=False)
                .execute()
            ).data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list rewards catalog: {exc}") from exc

    def list_all_rewards(self) -> list[dict[str, Any]]:
        try:
            return (
                self.client.table("rewards")
                .select("id, name_th, description_th, points_cost, stock_qty, active, image_url, created_at, updated_at")
                .order("points_cost", desc=False)
                .execute()
            ).data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list all rewards catalog: {exc}") from exc

    def create_reward(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            name_th = payload.get("name_th", "").strip()
            if not name_th:
                raise WorkflowError("Reward name is required")

            points_cost = payload.get("points_cost")
            if not points_cost or not isinstance(points_cost, int) or points_cost <= 0:
                raise WorkflowError("Points cost must be a positive integer")

            stock_qty = payload.get("stock_qty", 0)
            if not isinstance(stock_qty, int) or stock_qty < 0:
                raise WorkflowError("Stock quantity must be a non-negative integer")

            insert_data: dict[str, Any] = {
                "name_th": name_th,
                "description_th": payload.get("description_th", "").strip() or None,
                "points_cost": points_cost,
                "stock_qty": stock_qty,
                "active": payload.get("active", True),
            }
            if "image_url" in payload:
                insert_data["image_url"] = payload["image_url"] or None

            return _first_row(
                self.client.table("rewards").insert(insert_data).execute().data
            )
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to create reward: {exc}") from exc

    def update_reward(self, reward_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            if not reward_id:
                raise WorkflowError("Reward ID is required")

            name_th = payload.get("name_th", "").strip()
            if name_th:
                points_cost = payload.get("points_cost")
                if points_cost is not None and (not isinstance(points_cost, int) or points_cost <= 0):
                    raise WorkflowError("Points cost must be a positive integer")
                stock_qty = payload.get("stock_qty")
                if stock_qty is not None and (not isinstance(stock_qty, int) or stock_qty < 0):
                    raise WorkflowError("Stock quantity must be a non-negative integer")

            update_data: dict[str, Any] = {}
            if name_th:
                update_data["name_th"] = name_th
            if "description_th" in payload:
                update_data["description_th"] = (
                    payload["description_th"].strip() if payload["description_th"] else None
                )
            if "points_cost" in payload and payload["points_cost"] is not None:
                update_data["points_cost"] = payload["points_cost"]
            if "stock_qty" in payload and payload["stock_qty"] is not None:
                update_data["stock_qty"] = payload["stock_qty"]
            if "active" in payload:
                update_data["active"] = payload["active"]
            if "image_url" in payload:
                update_data["image_url"] = payload["image_url"] or None

            if not update_data:
                raise WorkflowError("No fields to update")

            self.client.table("rewards").update(update_data).eq("id", reward_id).execute()

            updated = (
                self.client.table("rewards")
                .select("id, name_th, description_th, points_cost, stock_qty, active, image_url, created_at, updated_at")
                .eq("id", reward_id)
                .limit(1)
                .execute()
            )
            if not (updated.data or []):
                raise WorkflowError("Reward not found")
            return _first_row(updated.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update reward: {exc}") from exc
