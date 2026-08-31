from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceKind(StrEnum):
    SYNTHETIC = "SYNTHETIC"
    LIVE_API = "LIVE_API"
    USER_UPLOAD = "USER_UPLOAD"
    PUBLIC_WEB = "PUBLIC_WEB"


class SemanticSourceKind(StrEnum):
    FIRST_PARTY = "FIRST_PARTY"
    THIRD_PARTY_ESTIMATE = "THIRD_PARTY_ESTIMATE"
    AI_INFERENCE = "AI_INFERENCE"
    USER_PROVIDED = "USER_PROVIDED"


class DateBasis(StrEnum):
    ORDER_DATE = "ORDER_DATE"
    TRAFFIC_DATE = "TRAFFIC_DATE"
    SNAPSHOT_TIME = "SNAPSHOT_TIME"
    DOCUMENT_DATE = "DOCUMENT_DATE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class DataPeriod(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: datetime
    end: datetime

    @model_validator(mode="after")
    def validate_order(self) -> DataPeriod:
        if self.end < self.start:
            raise ValueError("data period end must not be earlier than start")
        return self


class SourceReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    source_kind: SourceKind
    semantic_source_kind: SemanticSourceKind


class ProvenanceEnvelope(BaseModel):
    """Required lineage fields carried by every adapter and component result."""

    model_config = ConfigDict(extra="forbid")

    source: tuple[SourceReference, ...] = Field(min_length=1)
    collected_at: datetime
    data_period: DataPeriod
    marketplace: str = Field(min_length=1, max_length=32)
    timezone: str = Field(min_length=1, max_length=64)
    currency: str = Field(pattern=r"^(?:[A-Z]{3}|NOT_APPLICABLE)$")
    grain: str = Field(min_length=1, max_length=80)
    date_basis: DateBasis
    attribution_window: str = Field(min_length=1, max_length=80)
    is_estimated: bool
    synthetic: bool
    confidence: float = Field(ge=0.0, le=1.0)
    limitations: tuple[str, ...] = ()
    raw_record_reference: tuple[str, ...] = Field(min_length=1)
    schema_version: str = Field(default="1.0", min_length=1, max_length=32)

    @model_validator(mode="after")
    def validate_source_semantics(self) -> ProvenanceEnvelope:
        kinds = {item.source_kind for item in self.source}
        if self.synthetic and kinds != {SourceKind.SYNTHETIC}:
            raise ValueError("synthetic data must only use SYNTHETIC source_kind")
        if not self.synthetic and SourceKind.SYNTHETIC in kinds:
            raise ValueError("non-synthetic data cannot use SYNTHETIC source_kind")
        return self
