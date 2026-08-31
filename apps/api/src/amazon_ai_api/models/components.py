from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ComponentPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DataReferencePayload(ComponentPayload):
    data_ref: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=500)


class ExecutiveSummaryPayload(ComponentPayload):
    summary: str = Field(min_length=1, max_length=500)
    orders: int = Field(ge=0)
    sales: float = Field(ge=0)
    currency: Literal["USD"] = "USD"
    orders_delta_pct: float


class PositiveSignalPayload(ComponentPayload):
    label: str = Field(min_length=1, max_length=160)
    metric: str = Field(min_length=1, max_length=80)
    current_value: float
    delta_pct: float


class CriticalAlertPayload(ComponentPayload):
    severity: Literal["WARNING", "CRITICAL"]
    summary: str = Field(min_length=1, max_length=500)
    observed_value: float
    baseline_value: float
    delta_pct: float


class OrderFunnelPayload(ComponentPayload):
    sessions: int = Field(ge=0)
    orders: int = Field(ge=0)
    units: int = Field(ge=0)
    unit_session_percentage: float = Field(ge=0)


class AdDiagnosisPayload(ComponentPayload):
    spend: float = Field(ge=0)
    ad_sales: float = Field(ge=0)
    acos: float | None = Field(default=None, ge=0)
    finding: str = Field(min_length=1, max_length=500)
    attribution_window: str = Field(min_length=1, max_length=80)


class CompetitorChangePayload(ComponentPayload):
    competitor_count: int = Field(ge=0)
    summary: str = Field(min_length=1, max_length=500)
    is_estimated: bool


class ProductOpportunityPayload(ComponentPayload):
    candidate_count: int = Field(ge=0)
    summary: str = Field(min_length=1, max_length=500)
    score: float = Field(ge=0, le=100)
    is_estimated: bool = True


class ExperimentResultPayload(ComponentPayload):
    experiment_name: str = Field(min_length=1, max_length=200)
    status: Literal["RUNNING", "COMPLETED", "INCONCLUSIVE"]
    summary: str = Field(min_length=1, max_length=500)

