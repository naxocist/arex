from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class CreateSubmissionRequest(BaseModel):
    material_type: str = Field(min_length=1, max_length=50)
    quantity_value: float = Field(gt=0, le=1_000_000)
    quantity_unit: str = Field(min_length=1, max_length=50)
    pickup_location_text: str = Field(min_length=3, max_length=255)
    pickup_lat: float | None = Field(default=None, ge=-90, le=90)
    pickup_lng: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=2048)


class SchedulePickupRequest(BaseModel):
    pickup_window_start_at: datetime
    pickup_window_end_at: datetime
    destination_factory_id: str = Field(min_length=1, max_length=64)
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def end_after_start(self) -> "SchedulePickupRequest":
        if self.pickup_window_end_at <= self.pickup_window_start_at:
            raise ValueError("pickup_window_end_at must be after pickup_window_start_at")
        return self


class ConfirmFactoryIntakeRequest(BaseModel):
    pickup_job_id: str = Field(min_length=1, max_length=64)
    measured_weight_kg: float = Field(gt=0, le=100_000)
    discrepancy_note: str | None = Field(default=None, max_length=1000)


class UpsertFactoryInfoRequest(BaseModel):
    name_th: str = Field(min_length=1, max_length=255)
    location_text: str | None = Field(default=None, max_length=500)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class CreateRewardRequest(BaseModel):
    reward_id: str = Field(min_length=1, max_length=64)
    quantity: int = Field(gt=0, le=10)
    delivery_location_text: str | None = Field(default=None, max_length=500)
    delivery_lat: float | None = Field(default=None, ge=-90, le=90)
    delivery_lng: float | None = Field(default=None, ge=-180, le=180)


class ScheduleRewardDeliveryRequest(BaseModel):
    delivery_window_start_at: datetime
    delivery_window_end_at: datetime
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def end_after_start(self) -> "ScheduleRewardDeliveryRequest":
        if self.delivery_window_end_at <= self.delivery_window_start_at:
            raise ValueError("delivery_window_end_at must be after delivery_window_start_at")
        return self


class RejectRewardRequest(BaseModel):
    reason: str = Field(default="", max_length=1000)


class UpsertMaterialTypeRequest(BaseModel):
    name_th: str = Field(min_length=1, max_length=255)
    active: bool = True
    points_per_kg: float | None = Field(default=None, gt=0, le=10_000)


class UpsertMeasurementUnitRequest(BaseModel):
    name_th: str = Field(min_length=1, max_length=255)
    to_kg_factor: float | None = Field(default=None, gt=0, le=100_000)
    active: bool = True


class UpsertLogisticsInfoRequest(BaseModel):
    name_th: str = Field(min_length=1, max_length=255)
    location_text: str | None = Field(default=None, max_length=500)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)



class UpdateFarmerProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    province: str | None = Field(default=None, max_length=100)
