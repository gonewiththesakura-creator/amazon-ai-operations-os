from __future__ import annotations

from datetime import datetime
from typing import Any, Callable
from uuid import NAMESPACE_URL, UUID, uuid5

from pydantic import BaseModel, ValidationError

from amazon_ai_api.db.repositories.store_metrics import StoreMetricsRepository
from amazon_ai_api.models.home import EvidenceKind, EvidenceReference
from amazon_ai_api.models.provenance import DataPeriod
from amazon_ai_api.models.tools import StoreToolInput, ToolResult, ToolStatus
from amazon_ai_api.models.visualizations import (
    MetricSeriesToolInput,
    MixBreakdownToolInput,
    TopEntitiesToolInput,
)
from amazon_ai_api.orchestration.audit import AuditWriter
from amazon_ai_api.registries.tools import ToolRegistry
from amazon_ai_api.services.analytics.store import (
    analyze_ads,
    calculate_order_funnel,
    compare_store_orders,
    detect_store_order_anomaly,
)
from amazon_ai_api.services.business_clock import BusinessClock


class ToolAuthorizationError(PermissionError):
    pass


class ToolInputError(ValueError):
    pass


class ToolGateway:
    IMPLEMENTED = frozenset(
        {
            "get_store_summary",
            "get_order_funnel",
            "compare_periods",
            "detect_anomalies",
            "get_metric_series",
            "get_top_entities",
            "get_mix_breakdown",
        }
    )

    def __init__(
        self,
        *,
        registry: ToolRegistry,
        repository: StoreMetricsRepository,
        business_clock: BusinessClock,
        audit_writer: AuditWriter,
    ) -> None:
        self._registry = registry
        self._repository = repository
        self._clock = business_clock
        self._audit = audit_writer
        self._handlers: dict[str, Callable[[StoreToolInput], dict[str, Any]]] = {
            "get_store_summary": self._get_store_summary,
            "get_order_funnel": self._get_order_funnel,
            "compare_periods": self._compare_periods,
            "detect_anomalies": self._detect_anomalies,
            "get_metric_series": self._get_metric_series,
            "get_top_entities": self._get_top_entities,
            "get_mix_breakdown": self._get_mix_breakdown,
        }
        self._input_models: dict[str, type[BaseModel]] = {
            "get_metric_series": MetricSeriesToolInput,
            "get_top_entities": TopEntitiesToolInput,
            "get_mix_breakdown": MixBreakdownToolInput,
        }

    def execute(
        self,
        *,
        agent_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        granted_permissions: frozenset[str] = frozenset({"analytics:read"}),
    ) -> ToolResult:
        definition = self._registry.get(tool_name)
        tenant_id = self._tenant_from_untrusted(arguments)
        call_id = uuid5(
            NAMESPACE_URL,
            f"{agent_id}:{tool_name}:{sorted((key, str(value)) for key, value in arguments.items())}",
        )
        if agent_id not in definition.allowed_agents or definition.required_permission not in granted_permissions:
            self._audit.write_tool_event(
                tenant_id=tenant_id,
                tool_call_id=call_id,
                event_type="TOOL_DENIED",
                payload={"agent_id": agent_id, "tool_name": tool_name},
            )
            raise ToolAuthorizationError(f"agent {agent_id} is not authorized for tool {tool_name}")
        try:
            input_model = self._input_models.get(tool_name, StoreToolInput)
            validated = input_model.model_validate(arguments)
        except ValidationError as exc:
            self._audit.write_tool_event(
                tenant_id=tenant_id,
                tool_call_id=call_id,
                event_type="TOOL_INPUT_REJECTED",
                payload={"agent_id": agent_id, "tool_name": tool_name},
            )
            raise ToolInputError(f"invalid arguments for {tool_name}") from exc

        if tool_name not in self._handlers:
            result = ToolResult(
                tool_call_id=call_id,
                tool_name=tool_name,
                status=ToolStatus.NOT_IMPLEMENTED,
                output={},
                evidence_refs=(),
                data_period=None,
                source=(),
                updated_at=self._clock.now_utc(),
                confidence=0,
                limitations=("Tool is registered but not implemented in M1.",),
                synthetic=True,
            )
            self._audit.write_tool_event(
                tenant_id=validated.tenant_id,
                tool_call_id=call_id,
                event_type="TOOL_NOT_IMPLEMENTED",
                payload={"agent_id": agent_id, "tool_name": tool_name},
            )
            return result

        handler_output = self._handlers[tool_name](validated)
        output = {
            key: value for key, value in handler_output.items() if not key.startswith("_")
        }
        period_start = handler_output.get("_period_start", validated.business_date)
        period_end = handler_output.get("_period_end", validated.business_date)
        start = self._clock.business_day_period(period_start)[0]
        end = self._clock.business_day_period(period_end)[1]
        evidence = EvidenceReference(
            kind=EvidenceKind.TOOL_OUTPUT,
            reference_id=f"tool:{tool_name}:{call_id}",
        )
        result = ToolResult(
            tool_call_id=call_id,
            tool_name=tool_name,
            status=ToolStatus.SUCCEEDED,
            output=output,
            evidence_refs=(evidence,),
            data_period=DataPeriod(start=start, end=end),
            source=tuple(handler_output["_source"]),
            updated_at=datetime.fromisoformat(str(handler_output["_updated_at"])),
            confidence=float(handler_output["_confidence"]),
            limitations=tuple(handler_output["_limitations"]),
            synthetic=bool(handler_output["_synthetic"]),
        )
        self._audit.write_tool_event(
            tenant_id=validated.tenant_id,
            tool_call_id=call_id,
            event_type="TOOL_SUCCEEDED",
            payload={"agent_id": agent_id, "tool_name": tool_name, "evidence": evidence.reference_id},
        )
        return result

    def _store(self, values: StoreToolInput):
        return self._repository.get_store_daily_summary(
            tenant_id=values.tenant_id,
            marketplace=values.marketplace,
            business_date=values.business_date,
        )

    def _metadata(self, summary) -> dict[str, Any]:
        return {
            "_source": summary.source_names,
            "_updated_at": summary.collected_at.isoformat(),
            "_confidence": 1.0,
            "_limitations": (
                f"Uses {summary.qualified_baseline_days} qualified baseline days.",
            ),
            "_synthetic": summary.synthetic,
        }

    def _get_store_summary(self, values: StoreToolInput) -> dict[str, Any]:
        summary = self._store(values)
        comparison = compare_store_orders(summary)
        return {
            "business_date": values.business_date.isoformat(),
            "sessions": summary.sessions,
            "orders": summary.orders,
            "units": summary.units,
            "sales": float(summary.sales),
            "currency": "USD",
            "maturity": summary.maturity,
            **comparison.model_dump(mode="json"),
            **self._metadata(summary),
        }

    def _get_order_funnel(self, values: StoreToolInput) -> dict[str, Any]:
        summary = self._store(values)
        return {**calculate_order_funnel(summary).model_dump(mode="json"), **self._metadata(summary)}

    def _compare_periods(self, values: StoreToolInput) -> dict[str, Any]:
        summary = self._store(values)
        return {**compare_store_orders(summary).model_dump(mode="json"), **self._metadata(summary)}

    def _detect_anomalies(self, values: StoreToolInput) -> dict[str, Any]:
        summary = self._store(values)
        result = detect_store_order_anomaly(compare_store_orders(summary))
        ads = self._repository.get_ads_daily_summary(
            tenant_id=values.tenant_id,
            marketplace=values.marketplace,
            business_date=values.business_date,
        )
        ad_result = analyze_ads(ads)
        metadata = self._metadata(summary)
        metadata["_source"] = tuple(sorted(set(summary.source_names + ads.source_names)))
        metadata["_confidence"] = 0.78 if ads.maturity == "PROVISIONAL" else 0.95
        metadata["_limitations"] = (
            "Sponsored Products attribution is provisional within the 14-day click window.",
        ) if ads.maturity == "PROVISIONAL" else ()
        return {
            **result.model_dump(mode="json"),
            "ad_signals": ad_result.model_dump(mode="json"),
            **metadata,
        }

    def _get_metric_series(self, values: MetricSeriesToolInput) -> dict[str, Any]:
        data = self._repository.get_metric_series(
            tenant_id=values.tenant_id,
            marketplace=values.marketplace,
            business_date=values.business_date,
            metric=values.metric,
            lookback_days=values.lookback_days,
        )
        return {
            **data.payload.model_dump(mode="json"),
            **self._visualization_metadata(data),
        }

    def _get_top_entities(self, values: TopEntitiesToolInput) -> dict[str, Any]:
        data = self._repository.get_top_entities(
            tenant_id=values.tenant_id,
            marketplace=values.marketplace,
            business_date=values.business_date,
            metric=values.metric,
            lookback_days=values.lookback_days,
            limit=values.limit,
        )
        return {
            **data.payload.model_dump(mode="json"),
            **self._visualization_metadata(data),
        }

    def _get_mix_breakdown(self, values: MixBreakdownToolInput) -> dict[str, Any]:
        data = self._repository.get_mix_breakdown(
            tenant_id=values.tenant_id,
            marketplace=values.marketplace,
            business_date=values.business_date,
            metric=values.metric,
            lookback_days=values.lookback_days,
            max_slices=values.max_slices,
        )
        return {
            **data.payload.model_dump(mode="json"),
            **self._visualization_metadata(data),
        }

    @staticmethod
    def _visualization_metadata(data: Any) -> dict[str, Any]:
        return {
            "_source": data.source_names,
            "_updated_at": data.collected_at.isoformat(),
            "_confidence": data.confidence,
            "_limitations": data.limitations,
            "_synthetic": data.synthetic,
            "_period_start": data.start_date,
            "_period_end": data.end_date,
        }

    @staticmethod
    def _tenant_from_untrusted(arguments: dict[str, Any]) -> UUID:
        try:
            return UUID(str(arguments.get("tenant_id")))
        except (TypeError, ValueError) as exc:
            raise ToolInputError("tenant_id is required and must be a UUID") from exc
