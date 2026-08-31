from __future__ import annotations

from datetime import date
from enum import StrEnum
from uuid import NAMESPACE_URL, UUID, uuid5

from pydantic import BaseModel, ConfigDict

from amazon_ai_api.models.chat import ChatContext, ChatResponse
from amazon_ai_api.models.home import HomeComposition, JudgmentReason
from amazon_ai_api.orchestration.agents.store_operations import (
    StoreAgentResult,
    StoreOperationsAgent,
)
from amazon_ai_api.orchestration.openai_runtime import HomeAIComposer
from amazon_ai_api.services.home_composition import HomeCompositionService


class TriggerType(StrEnum):
    DAILY_HOME = "DAILY_HOME"
    USER_QUESTION = "USER_QUESTION"


class DailyHomeRun(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trigger: TriggerType
    agent_result: StoreAgentResult
    composition: HomeComposition


class JarvisSupervisor:
    """M1 control plane for the first store-operations vertical slice."""

    def __init__(
        self,
        *,
        store_agent: StoreOperationsAgent,
        deterministic_composer: HomeCompositionService,
        ai_composer: HomeAIComposer | None = None,
    ) -> None:
        self._store_agent = store_agent
        self._deterministic_composer = deterministic_composer
        self._ai_composer = ai_composer

    async def daily_home_run(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> DailyHomeRun:
        agent_result = self._store_agent.run(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        candidate = await self._deterministic_composer.get_composition(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        deterministic = candidate.model_copy(
            update={
                "overall_judgment": agent_result.summary,
                "judgment_reasons": tuple(
                    JudgmentReason(claim=item.claim, evidence_refs=item.evidence_refs)
                    for item in agent_result.findings[:2]
                ),
            }
        )
        composition = HomeComposition.model_validate(deterministic.model_dump())
        if self._ai_composer is not None:
            try:
                composition = self._ai_composer.compose(
                    candidate=composition,
                    findings=agent_result.findings,
                )
            except Exception:
                composition = self._with_ai_mode(composition, "DETERMINISTIC_FALLBACK")
        else:
            composition = self._with_ai_mode(composition, "DETERMINISTIC_FALLBACK")
        return DailyHomeRun(
            trigger=TriggerType.DAILY_HOME,
            agent_result=agent_result,
            composition=composition,
        )

    async def daily_home(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> HomeComposition:
        run = await self.daily_home_run(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        return run.composition

    def answer_question(
        self,
        *,
        tenant_id: UUID,
        message: str,
        marketplace: str,
        business_date: date,
        context: ChatContext,
    ) -> ChatResponse:
        agent_result = self._store_agent.run(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            question=message,
        )
        comparison = next(
            item for item in agent_result.tool_results if item.tool_name == "compare_periods"
        )
        anomalies = next(
            item for item in agent_result.tool_results if item.tool_name == "detect_anomalies"
        )
        values = comparison.output
        ads = anomalies.output["ad_signals"]
        normalized_message = message.casefold()
        asks_about_ads = any(
            term in normalized_message
            for term in ("广告", "竞价", "预算", "ad ", "ads", "bid", "budget")
        )
        if asks_about_ads:
            answer = (
                "现在不建议直接修改广告。Sponsored Products 花费变化 "
                f"{float(ads['spend_delta_pct']):+.2f}%，归因销售变化 "
                f"{float(ads['attributed_sales_delta_pct']):+.2f}%，但归因状态仍为 "
                f"{ads['maturity']}（{ads['attribution_window']}）。当前工具尚未验证库存可售、"
                "价格和 Buy Box，因此在这些检查完成且归因成熟前，不应放量；系统也不会执行任何修改。"
            )
            followups = (
                "先检查哪些转化阻断？",
                "广告归因成熟后应该复核什么？",
                "为广告调整创建只读审批草案",
            )
        else:
            answer = (
                f"今日订单为 {int(values['current_orders'])}，较 28 日合格基线 "
                f"{float(values['orders_delta_pct']):+.2f}%。Sessions 变化 "
                f"{float(values['sessions_delta_pct']):+.2f}%，CVR 变化 "
                f"{float(values['cvr_delta_pct']):+.2f}%，所以流量下降只能解释一部分订单降幅。"
                "目前最应先验证库存可售、价格、Buy Box 和 Listing 转化阻断，再审核广告调整草案。"
            )
            followups = (
                "我现在应该先改广告吗？",
                "先检查哪些转化阻断？",
                "今天先处理哪三件事？",
            )

        evidence_by_id = {
            (ref.kind, ref.reference_id): ref
            for finding in agent_result.findings
            for ref in finding.evidence_refs
        }
        evidence = tuple(evidence_by_id.values())
        run_id = uuid5(
            NAMESPACE_URL,
            (
                f"{tenant_id}:{marketplace}:{business_date.isoformat()}:chat:{message}:"
                f"{context.previous_ai_run_id or 'root'}"
            ),
        )
        return ChatResponse(
            answer=answer,
            findings=agent_result.findings,
            evidence_refs=evidence,
            suggested_followups=followups,
            context_snapshot=context.model_copy(update={"previous_ai_run_id": run_id}),
            ai_run_id=run_id,
            synthetic=agent_result.synthetic,
        )

    @staticmethod
    def _with_ai_mode(composition: HomeComposition, mode: str) -> HomeComposition:
        updated = composition.model_copy(
            update={"data_status": composition.data_status.model_copy(update={"ai_mode": mode})}
        )
        return HomeComposition.model_validate(updated.model_dump())
