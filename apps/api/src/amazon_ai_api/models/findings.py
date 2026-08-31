from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from amazon_ai_api.models.home import EvidenceReference
from amazon_ai_api.models.provenance import DataPeriod


class CausalStatus(StrEnum):
    OBSERVED = "OBSERVED"
    ASSOCIATION = "ASSOCIATION"
    HYPOTHESIS = "HYPOTHESIS"
    CONFIRMED_CAUSAL = "CONFIRMED_CAUSAL"


class FindingEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    finding_id: UUID
    agent_id: str = Field(min_length=1, max_length=80)
    finding_type: str = Field(min_length=1, max_length=80)
    claim: str = Field(min_length=1, max_length=800)
    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)
    data_period: DataPeriod
    confidence: float = Field(ge=0, le=1)
    causal_status: CausalStatus
    limitations: tuple[str, ...]
    alternative_hypotheses: tuple[str, ...]
    recommended_next_step: str = Field(min_length=1, max_length=800)
    synthetic: bool

    @model_validator(mode="after")
    def confirmed_causal_requires_experiment_evidence(self) -> "FindingEnvelope":
        if self.causal_status is CausalStatus.CONFIRMED_CAUSAL and not any(
            ref.reference_id.startswith("experiment:") for ref in self.evidence_refs
        ):
            raise ValueError("CONFIRMED_CAUSAL requires experiment evidence")
        return self

