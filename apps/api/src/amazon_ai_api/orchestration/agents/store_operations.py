from __future__ import annotations

from datetime import date
from uuid import NAMESPACE_URL, UUID, uuid5

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.models.findings import CausalStatus, FindingEnvelope
from amazon_ai_api.models.tools import ToolResult, ToolStatus
from amazon_ai_api.orchestration.tool_gateway import ToolGateway


class StoreAgentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: UUID
    agent_id: str = "store_operations"
    summary: str = Field(min_length=1, max_length=1200)
    findings: tuple[FindingEnvelope, ...] = Field(min_length=1)
    tool_results: tuple[ToolResult, ...] = Field(min_length=1)
    recommended_next_step: str = Field(min_length=1, max_length=800)
    synthetic: bool


class StoreOperationsAgent:
    AGENT_ID = "store_operations"
    TOOL_SEQUENCE = (
        "get_store_summary",
        "get_order_funnel",
        "compare_periods",
        "detect_anomalies",
    )

    def __init__(self, gateway: ToolGateway) -> None:
        self._gateway = gateway

    def run(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        question: str | None = None,
    ) -> StoreAgentResult:
        arguments = {
            "tenant_id": str(tenant_id),
            "marketplace": marketplace,
            "business_date": business_date.isoformat(),
        }
        tools = tuple(
            self._gateway.execute(
                agent_id=self.AGENT_ID,
                tool_name=tool_name,
                arguments=arguments,
            )
            for tool_name in self.TOOL_SEQUENCE
        )
        if any(item.status is not ToolStatus.SUCCEEDED for item in tools):
            raise RuntimeError("store operations vertical slice requires all four tools")

        by_name = {item.tool_name: item for item in tools}
        comparison = by_name["compare_periods"]
        anomaly = by_name["detect_anomalies"]
        values = comparison.output
        anomaly_values = anomaly.output
        ad_values = anomaly_values["ad_signals"]
        orders_delta = float(values["orders_delta_pct"])
        sessions_delta = float(values["sessions_delta_pct"])
        cvr_delta = float(values["cvr_delta_pct"])

        findings = (
            self._finding(
                tenant_id=tenant_id,
                marketplace=marketplace,
                business_date=business_date,
                suffix="orders",
                finding_type="ORDER_CHANGE",
                claim=(
                    f"Orders are {int(values['current_orders'])}, versus a qualified "
                    f"baseline of {float(values['baseline_orders']):.2f}, a change of "
                    f"{orders_delta:+.2f}%."
                ),
                tool=comparison,
                confidence=comparison.confidence,
                causal_status=CausalStatus.OBSERVED,
                limitations=comparison.limitations,
                alternative_hypotheses=(),
                next_step="Decompose the order change into traffic and conversion signals.",
            ),
            self._finding(
                tenant_id=tenant_id,
                marketplace=marketplace,
                business_date=business_date,
                suffix="traffic-conversion",
                finding_type="FUNNEL_ASSOCIATION",
                claim=(
                    f"Sessions changed {sessions_delta:+.2f}% while CVR changed "
                    f"{cvr_delta:+.2f}%; traffic decline alone does not explain the "
                    "full order decline."
                ),
                tool=comparison,
                confidence=min(comparison.confidence, 0.92),
                causal_status=CausalStatus.ASSOCIATION,
                limitations=(
                    *comparison.limitations,
                    "The comparison identifies association, not a causal mechanism.",
                ),
                alternative_hypotheses=(
                    "Availability, price, or offer eligibility may have constrained conversion.",
                    "Listing or traffic-mix changes may have reduced conversion quality.",
                ),
                next_step="Verify availability, price, Buy Box, and listing conversion blockers.",
            ),
            self._finding(
                tenant_id=tenant_id,
                marketplace=marketplace,
                business_date=business_date,
                suffix="sponsored-products",
                finding_type="AD_ATTRIBUTION_ASSOCIATION",
                claim=(
                    f"Sponsored Products spend changed {float(ad_values['spend_delta_pct']):+.2f}% "
                    f"while attributed sales changed "
                    f"{float(ad_values['attributed_sales_delta_pct']):+.2f}%; attribution "
                    f"status is {ad_values['maturity']}."
                ),
                tool=anomaly,
                confidence=anomaly.confidence,
                causal_status=CausalStatus.ASSOCIATION,
                limitations=anomaly.limitations,
                alternative_hypotheses=(
                    "Recent clicks may convert before the attribution window matures.",
                ),
                next_step="Review Sponsored Products terms without changing bids or budgets yet.",
            ),
        )
        summary = (
            f"Orders changed {orders_delta:+.2f}%. Sessions changed {sessions_delta:+.2f}% "
            f"and CVR changed {cvr_delta:+.2f}%, so traffic alone does not explain the result. "
            f"Sponsored Products attribution is {ad_values['maturity']}."
        )
        return StoreAgentResult(
            run_id=self._id(tenant_id, marketplace, business_date, f"run:{question or 'daily'}"),
            summary=summary,
            findings=findings,
            tool_results=tools,
            recommended_next_step=(
                "Check availability, price, offer eligibility, and listing conversion before "
                "reviewing an advertising change draft."
            ),
            synthetic=all(item.synthetic for item in tools),
        )

    def _finding(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        suffix: str,
        finding_type: str,
        claim: str,
        tool: ToolResult,
        confidence: float,
        causal_status: CausalStatus,
        limitations: tuple[str, ...],
        alternative_hypotheses: tuple[str, ...],
        next_step: str,
    ) -> FindingEnvelope:
        if tool.data_period is None:
            raise RuntimeError("successful tool result is missing its data period")
        return FindingEnvelope(
            finding_id=self._id(tenant_id, marketplace, business_date, f"finding:{suffix}"),
            agent_id=self.AGENT_ID,
            finding_type=finding_type,
            claim=claim,
            evidence_refs=tool.evidence_refs,
            data_period=tool.data_period,
            source=tool.source,
            updated_at=tool.updated_at,
            confidence=confidence,
            causal_status=causal_status,
            limitations=limitations,
            alternative_hypotheses=alternative_hypotheses,
            recommended_next_step=next_step,
            synthetic=tool.synthetic,
        )

    @staticmethod
    def _id(tenant_id: UUID, marketplace: str, business_date: date, suffix: str) -> UUID:
        return uuid5(
            NAMESPACE_URL,
            f"{tenant_id}:{marketplace}:{business_date.isoformat()}:store_operations:{suffix}",
        )
