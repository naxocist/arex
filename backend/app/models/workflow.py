from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class QuantityUnit(str, Enum):
    KG = "kg"
    TON = "ton"
    M3 = "m3"


class MaterialType(str, Enum):
    RICE_STRAW = "rice_straw"
    CASSAVA_ROOT = "cassava_root"
    SUGARCANE_BAGASSE = "sugarcane_bagasse"
    CORN_STOVER = "corn_stover"


class CreateSubmissionRequest(BaseModel):
    material_type: MaterialType
    quantity_value: float = Field(gt=0)
    quantity_unit: QuantityUnit
    pickup_location_text: str = Field(min_length=3, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)


class SchedulePickupRequest(BaseModel):
    planned_pickup_at: datetime
    notes: str | None = Field(default=None, max_length=500)


class ConfirmFactoryIntakeRequest(BaseModel):
    pickup_job_id: str
    measured_weight_kg: float = Field(gt=0)
    discrepancy_note: str | None = Field(default=None, max_length=1000)


class CreateRewardRequest(BaseModel):
    reward_id: str
    quantity: int = Field(gt=0, le=10)


class ScheduleRewardDeliveryRequest(BaseModel):
    planned_delivery_at: datetime
    notes: str | None = Field(default=None, max_length=500)


class RejectRewardRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)
