from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from amazon_ai_api.models.home import HomeState
from amazon_ai_api.models.provenance import ProvenanceEnvelope


class AdapterDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    adapter_id: str = Field(min_length=1, max_length=80)
    mode: Literal["SYNTHETIC", "LIVE"]
    read_only: Literal[True] = True
    capabilities: tuple[str, ...] = Field(min_length=1)


class HomeSnapshot(BaseModel):
    """Typed adapter output. Ratio metrics are calculated, never supplied by an LLM."""

    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    marketplace: str
    business_date: date
    state: HomeState
    collected_at: datetime
    sessions: int = Field(ge=0)
    orders: int = Field(ge=0)
    units: int = Field(ge=0)
    sales: float = Field(ge=0)
    baseline_orders: float = Field(ge=0)
    baseline_sessions: float = Field(ge=0)
    baseline_units: float = Field(ge=0)
    ad_spend: float = Field(ge=0)
    ad_sales: float = Field(ge=0)
    positive_metric_value: float
    positive_metric_delta_pct: float
    data_maturity: str
    attribution_window: str
    provenance_by_domain: dict[str, ProvenanceEnvelope]

    @computed_field
    @property
    def orders_delta_pct(self) -> float:
        if self.baseline_orders == 0:
            return 0.0
        return round((self.orders - self.baseline_orders) / self.baseline_orders * 100, 2)

    @computed_field
    @property
    def unit_session_percentage(self) -> float:
        if self.sessions == 0:
            return 0.0
        return round(self.units / self.sessions * 100, 2)

    @computed_field
    @property
    def acos(self) -> float | None:
        if self.ad_sales == 0:
            return None
        return round(self.ad_spend / self.ad_sales * 100, 2)


class Adapter(ABC):
    @property
    @abstractmethod
    def descriptor(self) -> AdapterDescriptor:
        raise NotImplementedError

    @abstractmethod
    async def read_home_snapshot(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
    ) -> HomeSnapshot:
        raise NotImplementedError
