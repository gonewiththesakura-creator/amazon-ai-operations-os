from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from amazon_ai_api.models.home import EvidenceReference
from amazon_ai_api.models.provenance import DataPeriod


class ToolStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    DENIED = "DENIED"
    FAILED = "FAILED"


class StoreToolInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    marketplace: str = Field(min_length=1, max_length=32)
    business_date: date


class ToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool_call_id: UUID
    tool_name: str
    status: ToolStatus
    output: dict[str, Any]
    evidence_refs: tuple[EvidenceReference, ...]
    data_period: DataPeriod | None
    source: tuple[str, ...]
    updated_at: datetime
    confidence: float = Field(ge=0, le=1)
    limitations: tuple[str, ...]
    synthetic: bool

    @model_validator(mode="after")
    def successful_results_require_evidence(self) -> "ToolResult":
        if self.status is ToolStatus.SUCCEEDED and (
            not self.evidence_refs or self.data_period is None or not self.source
        ):
            raise ValueError("successful tool results require evidence, data period, and source")
        return self

