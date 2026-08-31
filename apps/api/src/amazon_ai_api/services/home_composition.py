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
from amazon_ai_api.services.analytics.store import _delta


class HomeCompositionService:
    """Temporary deterministic composer used by the M1 Supervisor fallback."""

    def __init__(
        self, *, adapter: Adapter, component_registry: ComponentRegistry, ai_mode: str
    ) -> None:
        if not adapter.descriptor.read_only:
            raise ValueError("MVP home adapter must be read-only")
        self._adapter = adapter
        self._components = component_registry
        self._ai_mode = ai_mode

    async def get_composition(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> HomeComposition:
        snapshot = await self._adapter.read_home_snapshot(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        composition = (
            self._anomaly_composition(snapshot)
            if snapshot.state is HomeState.ORDER_AD_ANOMALY
            else self._normal_composition(snapshot)
        )
        for block in composition.blocks:
            self._components.validate_block(block)
        return composition

    def _normal_composition(self, snapshot: HomeSnapshot) -> HomeComposition:
        orders = self._evidence(snapshot, "orders")
        conversion = self._evidence(snapshot, "unit_session_percentage")
        delta = snapshot.orders_delta_pct
        blocks = (
            self._block(
                snapshot,
                component_type=ComponentType.EXECUTIVE_SUMMARY,
                priority=1,
                title="店铺订单处于合格基线范围",
                display_reason="确定性异常检测未触发，先显示经营概览。",
                payload={
                    "summary": f"订单为 {snapshot.orders}，较 28 日合格基线变化 {delta:+.2f}%。",
                    "orders": snapshot.orders,
                    "sales": snapshot.sales,
                    "currency": "USD",
                    "orders_delta_pct": delta,
                },
                evidence=(orders,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.95,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.POSITIVE_SIGNAL,
                priority=2,
                title="当前转化表现",
                display_reason="展示由订单与 Sessions 直接复算的转化指标。",
                payload={
                    "label": "Unit Session Percentage",
                    "metric": "unit_session_percentage",
                    "current_value": snapshot.unit_session_percentage,
                    "delta_pct": snapshot.positive_metric_delta_pct,
                },
                evidence=(conversion,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.94,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.FOLLOW_UP_QUESTION,
                priority=3,
                title="继续分析",
                display_reason="保留当前业务日期与店铺上下文继续追问。",
                payload={"data_ref": "chat:store-context", "summary": "今天先处理哪三件事？"},
                evidence=(orders,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.9,
            ),
        )
        return self._composition(
            snapshot,
            judgment=f"今日订单 {snapshot.orders}，较合格基线 {delta:+.2f}%，未达到重大异常阈值。",
            confidence=0.93,
            reasons=(JudgmentReason(claim="订单变化未达到 -20% 异常阈值。", evidence_refs=(orders,)),),
            top_issue=SignalSummary(summary="没有达到重大订单异常阈值。", severity="INFO", evidence_refs=(orders,)),
            best_signal=SignalSummary(summary="当前店铺数据可用于确定性分析。", evidence_refs=(conversion,)),
            actions=(self._action(snapshot, 1, "继续监控订单与转化", "CREATE_MONITORING_DRAFT", orders),),
            blocks=blocks,
        )

    def _anomaly_composition(self, snapshot: HomeSnapshot) -> HomeComposition:
        orders = self._evidence(snapshot, "orders_drop", EvidenceKind.ANOMALY)
        funnel = self._evidence(snapshot, "order_funnel", EvidenceKind.TOOL_OUTPUT)
        ads = self._evidence(snapshot, "ad_efficiency", EvidenceKind.TOOL_OUTPUT)
        sessions_delta = _delta(snapshot.sessions, snapshot.baseline_sessions)
        current_cvr = snapshot.orders / snapshot.sessions * 100 if snapshot.sessions else 0
        baseline_cvr = (
            snapshot.baseline_orders / snapshot.baseline_sessions * 100
            if snapshot.baseline_sessions
            else 0
        )
        cvr_delta = _delta(current_cvr, baseline_cvr)
        blocks = (
            self._block(
                snapshot,
                component_type=ComponentType.CRITICAL_ALERT,
                priority=1,
                title="今日订单显著低于合格基线",
                display_reason="订单降幅超过确定性异常阈值，必须优先展示。",
                payload={
                    "severity": "CRITICAL",
                    "summary": f"订单下降 {abs(snapshot.orders_delta_pct):.2f}%，Sessions 与 CVR 同时走弱。",
                    "observed_value": float(snapshot.orders),
                    "baseline_value": float(snapshot.baseline_orders),
                    "delta_pct": snapshot.orders_delta_pct,
                },
                evidence=(orders,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.98,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.ORDER_FUNNEL,
                priority=2,
                title="订单漏斗",
                display_reason="用于区分流量下降与转化下降的贡献。",
                payload={
                    "sessions": snapshot.sessions,
                    "orders": snapshot.orders,
                    "units": snapshot.units,
                    "unit_session_percentage": snapshot.unit_session_percentage,
                },
                evidence=(funnel,),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.97,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.AD_DIAGNOSIS,
                priority=3,
                title="Sponsored Products 归因信号",
                display_reason="花费和归因销售来自相同归因窗口，但当天仍为 provisional。",
                payload={
                    "spend": snapshot.ad_spend,
                    "ad_sales": snapshot.ad_sales,
                    "acos": snapshot.acos,
                    "finding": "广告花费未同步下降，但归因销售走弱；当前只判定关联，不下因果结论。",
                    "attribution_window": snapshot.attribution_window,
                },
                evidence=(ads,),
                provenance=(snapshot.provenance_by_domain["ads"],),
                confidence=0.78 if snapshot.data_maturity == "PROVISIONAL" else 0.93,
                limitations=("广告归因窗口尚未成熟。",) if snapshot.data_maturity == "PROVISIONAL" else (),
            ),
            self._block(
                snapshot,
                component_type=ComponentType.PRIORITY_ACTION,
                priority=4,
                title="先验证转化下降原因，再决定是否调整广告",
                display_reason="CVR 降幅比 Sessions 降幅更大，先做只读诊断可以避免错误放量。",
                payload={
                    "data_ref": "recommendation:store-order-anomaly",
                    "summary": f"Sessions {sessions_delta:+.2f}%，CVR {cvr_delta:+.2f}%；先检查可售、价格与详情页，再审核广告草案。",
                },
                evidence=(orders, funnel, ads),
                provenance=(snapshot.provenance_by_domain["retail"], snapshot.provenance_by_domain["ads"]),
                confidence=0.9,
                requires_approval=True,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.DATA_TABLE,
                priority=5,
                title="确定性诊断输出",
                display_reason="公开本次比较的数据库数据引用。",
                payload={
                    "data_ref": f"postgres:store-day:{snapshot.tenant_id}:{snapshot.business_date}",
                    "summary": f"28 个成熟基线日；Orders {snapshot.orders_delta_pct:+.2f}%，Sessions {sessions_delta:+.2f}%，CVR {cvr_delta:+.2f}%。",
                },
                evidence=(orders, funnel),
                provenance=(snapshot.provenance_by_domain["retail"],),
                confidence=0.98,
            ),
            self._block(
                snapshot,
                component_type=ComponentType.FOLLOW_UP_QUESTION,
                priority=6,
                title="继续追问",
                display_reason="在相同业务日期和 marketplace 上继续分析。",
                payload={"data_ref": "chat:store-context", "summary": "我现在应该先改广告吗？"},
                evidence=(orders, ads),
                provenance=(snapshot.provenance_by_domain["retail"], snapshot.provenance_by_domain["ads"]),
                confidence=0.9,
            ),
        )
        return self._composition(
            snapshot,
            judgment=(
                f"今日订单下降 {abs(snapshot.orders_delta_pct):.2f}%。流量下降只能解释一部分，"
                f"CVR 同时下降 {abs(cvr_delta):.2f}%，应先排查转化阻断，再审核广告调整。"
            ),
            confidence=0.94,
            reasons=(
                JudgmentReason(claim=f"订单较 28 日基线下降 {abs(snapshot.orders_delta_pct):.2f}%。", evidence_refs=(orders,)),
                JudgmentReason(claim=f"Sessions {sessions_delta:+.2f}%，CVR {cvr_delta:+.2f}%。", evidence_refs=(funnel,)),
            ),
            top_issue=SignalSummary(summary="订单、Sessions 与 CVR 同时下降。", severity="CRITICAL", evidence_refs=(orders, funnel)),
            best_signal=SignalSummary(summary="当前数据完整，可继续下钻；所有外部写操作仍禁用。", evidence_refs=(funnel,)),
            actions=(
                self._action(snapshot, 1, "检查可售、价格与 Listing 转化阻断", "CREATE_CONVERSION_REVIEW_DRAFT", funnel),
                self._action(snapshot, 2, "复核 SP 搜索词与预算，但暂不执行修改", "CREATE_AD_REVIEW_DRAFT", ads),
                self._action(snapshot, 3, "等待归因成熟后复查 ACOS", "CREATE_ATTRIBUTION_REVIEW_DRAFT", ads),
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
        sources = tuple(sorted({source.name for item in snapshot.provenance_by_domain.values() for source in item.source}))
        return HomeComposition(
            composition_id=self._uuid(snapshot, "composition"),
            tenant_id=snapshot.tenant_id,
            business_date=snapshot.business_date,
            generated_at=snapshot.collected_at,
            marketplace=snapshot.marketplace,
            home_state=snapshot.state,
            objective_profile=ObjectiveProfile.RECOVERY_RANK if snapshot.state is HomeState.ORDER_AD_ANOMALY else ObjectiveProfile.SCALE_GROWTH,
            overall_judgment=judgment,
            overall_confidence=confidence,
            requires_approval=True,
            judgment_reasons=reasons,
            top_issue=top_issue,
            best_signal=best_signal,
            top_actions=actions,
            data_status=DataStatus(
                status=snapshot.data_maturity,
                synthetic=True,
                updated_at=snapshot.collected_at,
                source_names=sources,
                ai_mode=self._ai_mode,
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
        return HomeBlock(
            block_id=self._uuid(snapshot, f"block:{component_type.value}"),
            component_type=component_type,
            priority=priority,
            display_reason=display_reason,
            title=title,
            payload=payload,
            evidence_refs=evidence,
            data_period=provenance[0].data_period,
            updated_at=snapshot.collected_at,
            confidence=confidence,
            limitations=limitations,
            requires_approval=requires_approval,
            synthetic=True,
            provenance=provenance,
        )

    def _action(
        self, snapshot: HomeSnapshot, priority: int, title: str, action_type: str, evidence: EvidenceReference
    ) -> ActionSummary:
        return ActionSummary(
            action_id=self._uuid(snapshot, f"action:{priority}:{action_type}"),
            priority=priority,
            title=title,
            action_type=action_type,
            reason="由确定性合成证据生成只读审批草案，不执行 Amazon 写操作。",
            requires_approval=True,
            evidence_refs=(evidence,),
        )

    def _evidence(
        self, snapshot: HomeSnapshot, label: str, kind: EvidenceKind = EvidenceKind.METRIC
    ) -> EvidenceReference:
        return EvidenceReference(kind=kind, reference_id=f"{kind.value.lower()}:{self._uuid(snapshot, f'evidence:{label}')}")

    @staticmethod
    def _uuid(snapshot: HomeSnapshot, suffix: str) -> UUID:
        return uuid5(
            NAMESPACE_URL,
            f"{snapshot.tenant_id}:{snapshot.marketplace}:{snapshot.business_date}:{snapshot.state.value}:{suffix}",
        )

