from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from amazon_ai_api.models.provenance import DataPeriod, ProvenanceEnvelope


class HomeState(StrEnum):
    NORMAL = "NORMAL"
    ORDER_AD_ANOMALY = "ORDER_AD_ANOMALY"
    INVENTORY_PROFIT_RISK = "INVENTORY_PROFIT_RISK"
    MARKET_POLICY_CHANGE = "MARKET_POLICY_CHANGE"
    DATA_INCOMPLETE = "DATA_INCOMPLETE"


class ObjectiveProfile(StrEnum):
    LAUNCH_GROWTH = "LAUNCH_GROWTH"
    SCALE_GROWTH = "SCALE_GROWTH"
    HARVEST_PROFIT = "HARVEST_PROFIT"
    RECOVERY_RANK = "RECOVERY_RANK"
    MIXED_STORE = "MIXED_STORE"


class ComponentType(StrEnum):
    EXECUTIVE_SUMMARY = "executive_summary"
    PRIORITY_ACTION = "priority_action"
    CRITICAL_ALERT = "critical_alert"
    POSITIVE_SIGNAL = "positive_signal"
    METRIC_CARD = "metric_card"
    LINE_CHART = "line_chart"
    COMPARISON_CHART = "comparison_chart"
    DATA_TABLE = "data_table"
    ORDER_FUNNEL = "order_funnel"
    AD_DIAGNOSIS = "ad_diagnosis"
    KEYWORD_OPPORTUNITY = "keyword_opportunity"
    COMPETITOR_CHANGE = "competitor_change"
    INVENTORY_RISK = "inventory_risk"
    PROFIT_SIMULATION = "profit_simulation"
    PRODUCT_OPPORTUNITY = "product_opportunity"
    POLICY_ALERT = "policy_alert"
    NEWS_IMPACT = "news_impact"
    EXPERIMENT_RESULT = "experiment_result"
    APPROVAL_REQUEST = "approval_request"
    FOLLOW_UP_QUESTION = "follow_up_question"


class EvidenceKind(StrEnum):
    METRIC = "METRIC"
    TOOL_OUTPUT = "TOOL_OUTPUT"
    RAW_RECORD = "RAW_RECORD"
    POLICY = "POLICY"
    DOCUMENT = "DOCUMENT"
    ANOMALY = "ANOMALY"


class EvidenceReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: EvidenceKind
    reference_id: str = Field(min_length=1, max_length=200)


class JudgmentReason(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim: str = Field(min_length=1, max_length=500)
    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)


class SignalSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=500)
    severity: str | None = Field(default=None, max_length=32)
    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)


class ActionSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_id: UUID
    priority: int = Field(ge=1, le=3)
    title: str = Field(min_length=1, max_length=240)
    action_type: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=1, max_length=500)
    requires_approval: bool = True
    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)


class DataStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(min_length=1, max_length=32)
    synthetic: bool
    updated_at: datetime
    source_names: tuple[str, ...] = Field(min_length=1)
    ai_mode: str = Field(pattern=r"^(ENABLED|DETERMINISTIC_FALLBACK)$")


class HomeBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    block_id: UUID
    component_type: ComponentType
    component_version: str = Field(default="1.0", min_length=1, max_length=32)
    priority: int = Field(ge=1)
    display_reason: str = Field(min_length=1, max_length=500)
    title: str = Field(min_length=1, max_length=240)
    payload: dict[str, Any]
    evidence_refs: tuple[EvidenceReference, ...] = Field(min_length=1)
    data_period: DataPeriod
    updated_at: datetime
    confidence: float = Field(ge=0.0, le=1.0)
    limitations: tuple[str, ...] = ()
    requires_approval: bool
    synthetic: bool
    provenance: tuple[ProvenanceEnvelope, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_provenance_mode(self) -> HomeBlock:
        if any(item.synthetic != self.synthetic for item in self.provenance):
            raise ValueError("block synthetic flag must match every provenance envelope")
        return self


class HomeComposition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(default="1.0", min_length=1, max_length=32)
    composition_id: UUID
    tenant_id: UUID
    business_date: date
    generated_at: datetime
    marketplace: str = Field(min_length=1, max_length=32)
    home_state: HomeState
    objective_profile: ObjectiveProfile
    overall_judgment: str = Field(min_length=1, max_length=500)
    overall_confidence: float = Field(ge=0.0, le=1.0)
    requires_approval: bool
    judgment_reasons: tuple[JudgmentReason, ...] = Field(min_length=1)
    top_issue: SignalSummary
    best_signal: SignalSummary
    top_actions: tuple[ActionSummary, ...] = Field(min_length=1, max_length=3)
    data_status: DataStatus
    blocks: tuple[HomeBlock, ...] = Field(min_length=1)
    synthetic: bool

    @model_validator(mode="after")
    def validate_composition(self) -> HomeComposition:
        priorities = [block.priority for block in self.blocks]
        if priorities != sorted(priorities) or len(priorities) != len(set(priorities)):
            raise ValueError("blocks must have unique ascending priorities")
        if any(block.synthetic != self.synthetic for block in self.blocks):
            raise ValueError("composition synthetic flag must match every block")
        action_priorities = [action.priority for action in self.top_actions]
        if action_priorities != list(range(1, len(action_priorities) + 1)):
            raise ValueError("top action priorities must be contiguous starting at 1")
        return self
