from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from amazon_ai_api.models.findings import FindingEnvelope
from amazon_ai_api.models.home import EvidenceReference


class ChatContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_date: date | None = None
    marketplace: str | None = Field(default=None, min_length=1, max_length=32)
    selected_asin: str | None = Field(default=None, max_length=32)
    selected_campaign: str | None = Field(default=None, max_length=160)
    home_composition_id: UUID | None = None
    previous_ai_run_id: UUID | None = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)
    marketplace: str = Field(min_length=1, max_length=32)
    business_date: date
    context: ChatContext = Field(default_factory=ChatContext)

    @model_validator(mode="after")
    def normalize_and_validate_context(self) -> "ChatRequest":
        if self.context.business_date not in (None, self.business_date):
            raise ValueError("context business_date must match request business_date")
        if self.context.marketplace not in (None, self.marketplace):
            raise ValueError("context marketplace must match request marketplace")
        self.context = self.context.model_copy(
            update={
                "business_date": self.business_date,
                "marketplace": self.marketplace,
            }
        )
        return self


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str = Field(min_length=1, max_length=3000)
    findings: tuple[FindingEnvelope, ...] = Field(min_length=1)
    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)
    suggested_followups: tuple[str, ...] = Field(min_length=1, max_length=4)
    context_snapshot: ChatContext
    ai_run_id: UUID
    synthetic: bool

    @model_validator(mode="after")
    def validate_synthetic_findings(self) -> "ChatResponse":
        if any(item.synthetic != self.synthetic for item in self.findings):
            raise ValueError("chat synthetic flag must match every finding")
        return self
