from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.models.home import EvidenceReference
from amazon_ai_api.models.provenance import DataPeriod
from amazon_ai_api.models.tools import StoreToolInput


class VisualizationScope(StrEnum):
    STORE = "STORE"


class MetricName(StrEnum):
    ORDERS = "orders"
    SALES = "sales"
    SESSIONS = "sessions"
    CVR = "cvr"
    AD_SPEND = "ad_spend"
    AD_SALES = "ad_sales"
    ACOS = "acos"
    CPC = "cpc"
    CTR = "ctr"
    INVENTORY_DAYS = "inventory_days"
    CONTRIBUTION_PROFIT = "contribution_profit"


class EntityMetric(StrEnum):
    ORDERS = "orders"
    SALES = "sales"
    SESSIONS = "sessions"


class MixMetric(StrEnum):
    ORDERS = "orders"
    SALES = "sales"


class EntityType(StrEnum):
    ASIN = "ASIN"


class MetricSeriesToolInput(StoreToolInput):
    metric: MetricName
    scope: VisualizationScope = VisualizationScope.STORE
    lookback_days: int = Field(default=30, ge=1, le=90)


class TopEntitiesToolInput(StoreToolInput):
    metric: EntityMetric
    scope: VisualizationScope = VisualizationScope.STORE
    entity_type: EntityType = EntityType.ASIN
    lookback_days: int = Field(default=30, ge=1, le=90)
    limit: int = Field(default=5, ge=1, le=5)


class MixBreakdownToolInput(StoreToolInput):
    metric: MixMetric
    scope: VisualizationScope = VisualizationScope.STORE
    entity_type: EntityType = EntityType.ASIN
    lookback_days: int = Field(default=30, ge=1, le=90)
    max_slices: int = Field(default=5, ge=2, le=5)


class TimeSeriesPoint(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    period: date
    value: float


class MetricSeriesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    metric: MetricName
    scope: VisualizationScope
    unit: str
    lookback_days: int = Field(ge=1, le=90)
    maturity: str
    points: tuple[TimeSeriesPoint, ...]


class RankedEntity(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    rank: int = Field(ge=1, le=5)
    entity_id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    value: float = Field(ge=0)


class TopEntitiesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    metric: EntityMetric
    scope: VisualizationScope
    entity_type: EntityType
    unit: str
    lookback_days: int = Field(ge=1, le=90)
    entities: tuple[RankedEntity, ...]


class MixCategory(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    label: str = Field(min_length=1)
    value: float = Field(ge=0)
    share_pct: float = Field(ge=0, le=100)
    entity_id: str | None = None


class MixBreakdownPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    metric: MixMetric
    scope: VisualizationScope
    entity_type: EntityType
    unit: str
    lookback_days: int = Field(ge=1, le=90)
    total: float = Field(gt=0)
    categories: tuple[MixCategory, ...] = Field(min_length=1, max_length=5)


class EvidenceBackedVisualization(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)
    data_period: DataPeriod
    source: tuple[str, ...] = Field(min_length=1)
    updated_at: datetime
    confidence: float = Field(ge=0, le=1)
    limitations: tuple[str, ...]
    synthetic: bool


class MetricSeriesVisualization(EvidenceBackedVisualization):
    metric: MetricName
    scope: VisualizationScope
    unit: str
    lookback_days: int = Field(ge=1, le=90)
    maturity: str
    points: tuple[TimeSeriesPoint, ...] = Field(min_length=1)


class TopEntitiesVisualization(EvidenceBackedVisualization):
    metric: EntityMetric
    scope: VisualizationScope
    entity_type: EntityType
    unit: str
    lookback_days: int = Field(ge=1, le=90)
    entities: tuple[RankedEntity, ...] = Field(min_length=1, max_length=5)


class MixBreakdownVisualization(EvidenceBackedVisualization):
    metric: MixMetric
    scope: VisualizationScope
    entity_type: EntityType
    unit: str
    lookback_days: int = Field(ge=1, le=90)
    total: float = Field(gt=0)
    categories: tuple[MixCategory, ...] = Field(min_length=1, max_length=5)


class HomeVisualizations(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_date: date
    marketplace: str
    lookback_days: int = Field(ge=1, le=90)
    metric_series: tuple[MetricSeriesVisualization, ...]
    top_entities: tuple[TopEntitiesVisualization, ...]
    mix_breakdowns: tuple[MixBreakdownVisualization, ...]
    synthetic: bool
