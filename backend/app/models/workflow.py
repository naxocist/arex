from datetime import datetime

from pydantic import BaseModel, Field


class CreateSubmissionRequest(BaseModel):
    material_type: str = Field(min_length=1, max_length=50)
    quantity_value: float = Field(gt=0)
    quantity_unit: str = Field(min_length=1, max_length=50)
    pickup_location_text: str = Field(min_length=3, max_length=255)
    pickup_lat: float | None = Field(default=None, ge=-90, le=90)
    pickup_lng: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=1000)


class SchedulePickupRequest(BaseModel):
    pickup_window_start_at: datetime
    pickup_window_end_at: datetime
    destination_factory_id: str = Field(min_length=1, max_length=64)
    notes: str | None = Field(default=None, max_length=500)


class ConfirmFactoryIntakeRequest(BaseModel):
    pickup_job_id: str
    measured_weight_kg: float = Field(gt=0)
    discrepancy_note: str | None = Field(default=None, max_length=1000)


class UpsertFactoryInfoRequest(BaseModel):
    name_th: str = Field(min_length=1, max_length=255)
    location_text: str | None = Field(default=None, max_length=500)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class CreateRewardRequest(BaseModel):
    reward_id: str
    quantity: int = Field(gt=0, le=10)


class ScheduleRewardDeliveryRequest(BaseModel):
    delivery_window_start_at: datetime
    delivery_window_end_at: datetime
    notes: str | None = Field(default=None, max_length=500)


class RejectRewardRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class UpsertMaterialTypeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name_th: str = Field(min_length=1, max_length=255)
    active: bool = True


class UpsertMeasurementUnitRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name_th: str = Field(min_length=1, max_length=255)
    to_kg_factor: float | None = Field(default=None, gt=0)
    active: bool = True


class UpsertMaterialPointRuleRequest(BaseModel):
    points_per_kg: float = Field(gt=0)
