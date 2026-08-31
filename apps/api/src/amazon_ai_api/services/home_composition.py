from __future__ import annotations

from datetime import date
from uuid import NAMESPACE_URL, UUID, uuid5

from amazon_ai_api.adapters.base import Adapter, HomeSnapshot
from amazon_ai_api.models.home import (
    ActionSummary,
    ComponentType,
    DataStatus,
    EvidenceKind,
    EvidenceReference,
    HomeBlock,
    HomeComposition,
    HomeState,
    JudgmentReason,
    ObjectiveProfile,
    SignalSummary,
)
from amazon_ai_api.models.provenance import ProvenanceEnvelope
from amazon_ai_api.registries.components import ComponentRegistry


class HomeCompositionService:
    def __init__(self, *, adapter: Adapter, component_registry: ComponentRegistry) -> None:
        if not adapter.descriptor.read_only:
            raise ValueError("MVP home adapter must be read-only")
        self._adapter = adapter
        self._components = component_registry

    async def get_composition(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        state: HomeState,
    ) -> HomeComposition:
        snapshot = await self._adapter.read_home_snapshot(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            state=state,
        )
        composition = (
            self._normal_composition(snapshot)
            if state is HomeState.NORMAL
            else self._anomaly_composition(snapshot)
        )
        for block in composition.blocks:
            self._components.validate_block(block)
        return composition

    def _normal_composition(self, snapshot: HomeSnapshot) -> HomeComposition:
        orders_evidence = self._evidence(snapshot, "orders")
        conversion_evidence = self._evidence(snapshot, "unit_session_percentage")
        market_evidence = self._evidence(snapshot, "product_opportunity")
        blocks = (
            self._block(
                snapshot,
                component_type=ComponentType.EXECUTIVE_SUMMARY,
                priority=1,
                title="经营稳定，存在可控增长空间",
                display_reason="店铺无重大异常，应先展示总体判断和增长方向。",
                payload={
                    "summary": "订单高于合格基线，广告效率稳定。",
                    "orders": snapshot.orders,
                    "sales": snapshot.sales,
                    "currency": "USD",
                    "orders_delta_pct": snapshot.orders_delta_pct,
                },
                evidence=(orders_evidence,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.94,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.POSITIVE_SIGNAL,
                priority=2,
                title="转化信号改善",
                display_reason="正常经营日优先呈现可验证的正向信号。",
                payload={
                    "label": "Unit Session Percentage 较基线改善",
                    "metric": "unit_session_percentage",
                    "current_value": snapshot.unit_session_percentage,
                    "delta_pct": snapshot.positive_metric_delta_pct,
                },
                evidence=(conversion_evidence,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.91,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.COMPETITOR_CHANGE,
                priority=3,
                title="竞品变化值得跟进",
                display_reason="当前没有高优先级风险，可把竞品信号作为增长输入。",
                payload={
                    "competitor_count": snapshot.competitor_count,
                    "summary": "已确认竞品集合中有 1 个价格变化，需继续观察。",
                    "is_estimated": True,
                },
                evidence=(self._evidence(snapshot, "competitor_change"),),
                provenance=(snapshot.provenance_by_domain["market"],),
                confidence=0.78,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.PRODUCT_OPPORTUNITY,
                priority=4,
                title="候选产品机会",
                display_reason="经营稳定时展示经过规则评分的选品候选，而不是制造告警。",
                payload={
                    "candidate_count": snapshot.product_candidate_count,
                    "summary": "候选池有 3 个方向达到初筛阈值，仍需成本与合规验证。",
                    "score": snapshot.product_opportunity_score,
                    "is_estimated": True,
                },
                evidence=(market_evidence,),
                provenance=(snapshot.provenance_by_domain["market"],),
                confidence=0.76,
                limitations=("候选机会使用第三方语义的合成估算信号。",),
            ),
            self._block(
                snapshot,
                component_type=ComponentType.EXPERIMENT_RESULT,
                priority=5,
                title="进行中的关键词实验",
                display_reason="稳定状态下继续跟踪已批准实验，不提前宣告结果。",
                payload={
                    "experiment_name": "核心词 Exact 流量增量实验",
                    "status": "RUNNING",
                    "summary": "观察窗口尚未结束，当前不下因果结论。",
                },
                evidence=(self._evidence(snapshot, "experiment_running"),),
                provenance=(snapshot.provenance_by_domain["ads"],),
                confidence=0.72,
                limitations=("广告归因窗口尚未成熟。",),
            ),
        )
        return self._composition(
            snapshot,
            judgment="店铺整体稳定，今天应优先扩大已验证流量并继续观察实验。",
            confidence=0.92,
            reasons=(
                JudgmentReason(
                    claim="订单高于上一合格基线。",
                    evidence_refs=(orders_evidence,),
                ),
                JudgmentReason(
                    claim="转化率保持在健康区间。",
                    evidence_refs=(conversion_evidence,),
                ),
            ),
            top_issue=SignalSummary(
                summary="没有达到重大异常阈值。",
                severity="INFO",
                evidence_refs=(orders_evidence,),
            ),
            best_signal=SignalSummary(
                summary="Unit Session Percentage 较基线改善。",
                evidence_refs=(conversion_evidence,),
            ),
            actions=(
                self._action(snapshot, 1, "创建高效关键词扩量实验草案", "CREATE_EXPERIMENT_DRAFT", conversion_evidence),
                self._action(snapshot, 2, "复核竞品价格变化", "CREATE_REVIEW_TASK", self._evidence(snapshot, "competitor_change")),
                self._action(snapshot, 3, "验证候选产品成本与合规", "CREATE_CANDIDATE_RESEARCH_DRAFT", market_evidence),
            ),
            blocks=blocks,
        )

    def _anomaly_composition(self, snapshot: HomeSnapshot) -> HomeComposition:
        orders_evidence = self._evidence(snapshot, "orders_drop")
        funnel_evidence = self._evidence(snapshot, "order_funnel")
        ads_evidence = self._evidence(snapshot, "ad_efficiency")
        blocks = (
            self._block(
                snapshot,
                component_type=ComponentType.CRITICAL_ALERT,
                priority=1,
                title="昨日订单显著下降",
                display_reason="订单降幅达到异常阈值，必须先于机会模块展示。",
                payload={
                    "severity": "CRITICAL",
                    "summary": "订单较合格基线下降，需要先定位流量和广告效率。",
                    "observed_value": float(snapshot.orders),
                    "baseline_value": float(snapshot.baseline_orders),
                    "delta_pct": snapshot.orders_delta_pct,
                },
                evidence=(orders_evidence,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.97,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.ORDER_FUNNEL,
                priority=2,
                title="订单漏斗",
                display_reason="订单异常后先检查流量与转化是否同时恶化。",
                payload={
                    "sessions": snapshot.sessions,
                    "orders": snapshot.orders,
                    "units": snapshot.units,
                    "unit_session_percentage": snapshot.unit_session_percentage,
                },
                evidence=(funnel_evidence,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.96,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.AD_DIAGNOSIS,
                priority=3,
                title="广告效率异常",
                display_reason="广告花费未同步下降且 ACOS 上升，是需要验证的主要关联因素。",
                payload={
                    "spend": snapshot.ad_spend,
                    "ad_sales": snapshot.ad_sales,
                    "acos": snapshot.acos,
                    "finding": "花费维持高位，但广告销售下降；需要检查浪费搜索词。",
                    "attribution_window": "14_DAY_CLICK",
                },
                evidence=(ads_evidence,),
                provenance=(snapshot.provenance_by_domain["ads"],),
                confidence=0.9,
                limitations=("广告转化仍可能在归因窗口内回补。",),
            ),
            self._block(
                snapshot,
                component_type=ComponentType.DATA_TABLE,
                priority=4,
                title="浪费搜索词候选",
                display_reason="广告诊断需要下钻到搜索词证据，当前只提供只读数据引用。",
                payload={
                    "data_ref": f"synthetic:search-terms:{snapshot.tenant_id}:{snapshot.business_date}",
                    "summary": "5 个搜索词进入高花费低转化复核队列。",
                },
                evidence=(self._evidence(snapshot, "search_term_review"),),
                provenance=(snapshot.provenance_by_domain["ads"],),
                confidence=0.86,
                limitations=("候选仅用于人工复核，尚未创建否定词。",),
            ),
        )
        return self._composition(
            snapshot,
            judgment="昨日订单下降，当前最强证据指向流量减少与广告效率恶化。",
            confidence=0.93,
            reasons=(
                JudgmentReason(
                    claim="订单较合格基线显著下降。",
                    evidence_refs=(orders_evidence,),
                ),
                JudgmentReason(
                    claim="广告花费高位但广告销售下降。",
                    evidence_refs=(ads_evidence,),
                ),
            ),
            top_issue=SignalSummary(
                summary="订单下降且广告 ACOS 升高。",
                severity="CRITICAL",
                evidence_refs=(orders_evidence, ads_evidence),
            ),
            best_signal=SignalSummary(
                summary="Listing 仍可售，当前未检测到库存归零。",
                evidence_refs=(self._evidence(snapshot, "availability_ok"),),
            ),
            actions=(
                self._action(snapshot, 1, "复核 5 个高花费低转化搜索词", "CREATE_SEARCH_TERM_REVIEW", ads_evidence),
                self._action(snapshot, 2, "生成否定关键词审批草案", "CREATE_NEGATIVE_KEYWORD_DRAFT", ads_evidence),
                self._action(snapshot, 3, "检查核心词流量与排名变化", "CREATE_KEYWORD_DIAGNOSTIC", funnel_evidence),
            ),
            blocks=blocks,
        )

    def _composition(
        self,
        snapshot: HomeSnapshot,
        *,
        judgment: str,
        confidence: float,
        reasons: tuple[JudgmentReason, ...],
        top_issue: SignalSummary,
        best_signal: SignalSummary,
        actions: tuple[ActionSummary, ...],
        blocks: tuple[HomeBlock, ...],
    ) -> HomeComposition:
        sources = sorted(
            {
                source.name
                for provenance in snapshot.provenance_by_domain.values()
                for source in provenance.source
            }
        )
        return HomeComposition(
            composition_id=self._uuid(snapshot, "composition"),
            tenant_id=snapshot.tenant_id,
            business_date=snapshot.business_date,
            generated_at=snapshot.collected_at,
            marketplace=snapshot.marketplace,
            home_state=snapshot.state,
            objective_profile=(
                ObjectiveProfile.SCALE_GROWTH
                if snapshot.state is HomeState.NORMAL
                else ObjectiveProfile.RECOVERY_RANK
            ),
            overall_judgment=judgment,
            overall_confidence=confidence,
            requires_approval=any(action.requires_approval for action in actions),
            judgment_reasons=reasons,
            top_issue=top_issue,
            best_signal=best_signal,
            top_actions=actions,
            data_status=DataStatus(
                status="SYNTHETIC",
                synthetic=True,
                updated_at=snapshot.collected_at,
                source_names=tuple(sources),
            ),
            blocks=blocks,
            synthetic=True,
        )

    def _block(
        self,
        snapshot: HomeSnapshot,
        *,
        component_type: ComponentType,
        priority: int,
        title: str,
        display_reason: str,
        payload: dict[str, object],
        evidence: tuple[EvidenceReference, ...],
        provenance: tuple[ProvenanceEnvelope, ...],
        confidence: float,
        limitations: tuple[str, ...] = (),
        requires_approval: bool = False,
    ) -> HomeBlock:
        period = provenance[0].data_period
        return HomeBlock(
            block_id=self._uuid(snapshot, f"block:{component_type.value}"),
            component_type=component_type,
            priority=priority,
            display_reason=display_reason,
            title=title,
            payload=payload,
            evidence_refs=evidence,
            data_period=period,
            updated_at=snapshot.collected_at,
            confidence=confidence,
            limitations=limitations,
            requires_approval=requires_approval,
            synthetic=True,
            provenance=provenance,
        )

    def _action(
        self,
        snapshot: HomeSnapshot,
        priority: int,
        title: str,
        action_type: str,
        evidence: EvidenceReference,
    ) -> ActionSummary:
        return ActionSummary(
            action_id=self._uuid(snapshot, f"action:{priority}:{action_type}"),
            priority=priority,
            title=title,
            action_type=action_type,
            reason="由合成证据生成审批/复核草案，不执行 Amazon 写操作。",
            requires_approval=True,
            evidence_refs=(evidence,),
        )

    def _evidence(self, snapshot: HomeSnapshot, label: str) -> EvidenceReference:
        return EvidenceReference(
            kind=EvidenceKind.METRIC,
            reference_id=f"metric:{self._uuid(snapshot, f'evidence:{label}')}",
        )

    @staticmethod
    def _uuid(snapshot: HomeSnapshot, suffix: str) -> UUID:
        return uuid5(
            NAMESPACE_URL,
            ":".join(
                (
                    str(snapshot.tenant_id),
                    snapshot.marketplace,
                    snapshot.business_date.isoformat(),
                    snapshot.state.value,
                    suffix,
                )
            ),
        )
