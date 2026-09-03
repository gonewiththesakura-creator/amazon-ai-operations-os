from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Query, Request

from amazon_ai_api.db.repositories.store_metrics import RepositoryDataNotFoundError
from amazon_ai_api.models.tools import ToolResult
from amazon_ai_api.models.visualizations import (
    HomeVisualizations,
    MetricName,
    MetricSeriesVisualization,
    MixBreakdownVisualization,
    TopEntitiesVisualization,
)
from amazon_ai_api.routes.dependencies import TenantId


router = APIRouter(prefix="/v1/visualizations", tags=["visualizations"])

HOME_SERIES = (
    MetricName.ORDERS,
    MetricName.SALES,
    MetricName.SESSIONS,
    MetricName.CVR,
    MetricName.AD_SPEND,
    MetricName.AD_SALES,
    MetricName.ACOS,
    MetricName.CPC,
    MetricName.CTR,
)


@router.get("/home", response_model=HomeVisualizations)
def get_home_visualizations(
    request: Request,
    tenant_id: TenantId,
    business_date: date | None = Query(default=None),
    marketplace: str = Query(default="ATVPDKIKX0DER", min_length=1, max_length=32),
    lookback_days: int = Query(default=30, ge=1, le=90),
) -> HomeVisualizations:
    resolved_date = business_date or request.app.state.business_clock.current_business_date()
    common_arguments: dict[str, object] = {
        "tenant_id": str(tenant_id),
        "marketplace": marketplace,
        "business_date": resolved_date.isoformat(),
        "scope": "STORE",
        "lookback_days": lookback_days,
    }
    series: list[MetricSeriesVisualization] = []
    for metric in HOME_SERIES:
        result = _execute_available(
            request,
            tool_name="get_metric_series",
            arguments={**common_arguments, "metric": metric.value},
        )
        if result is not None:
            series.append(
                MetricSeriesVisualization.model_validate(
                    {**result.output, **_evidence_envelope(result)}
                )
            )

    top_entities: list[TopEntitiesVisualization] = []
    top_result = _execute_available(
        request,
        tool_name="get_top_entities",
        arguments={
            **common_arguments,
            "metric": "sales",
            "entity_type": "ASIN",
            "limit": 5,
        },
    )
    if top_result is not None:
        top_entities.append(
            TopEntitiesVisualization.model_validate(
                {**top_result.output, **_evidence_envelope(top_result)}
            )
        )

    mix_breakdowns: list[MixBreakdownVisualization] = []
    mix_result = _execute_available(
        request,
        tool_name="get_mix_breakdown",
        arguments={
            **common_arguments,
            "metric": "sales",
            "entity_type": "ASIN",
            "max_slices": 5,
        },
    )
    if mix_result is not None:
        mix_breakdowns.append(
            MixBreakdownVisualization.model_validate(
                {**mix_result.output, **_evidence_envelope(mix_result)}
            )
        )

    artifacts = [*series, *top_entities, *mix_breakdowns]
    return HomeVisualizations(
        business_date=resolved_date,
        marketplace=marketplace,
        lookback_days=lookback_days,
        metric_series=tuple(series),
        top_entities=tuple(top_entities),
        mix_breakdowns=tuple(mix_breakdowns),
        synthetic=(
            all(item.synthetic for item in artifacts)
            if artifacts
            else request.app.state.settings.app_data_mode == "SYNTHETIC"
        ),
    )


def _execute_available(
    request: Request, *, tool_name: str, arguments: dict[str, object]
) -> ToolResult | None:
    try:
        return request.app.state.tool_gateway.execute(
            agent_id="store_operations",
            tool_name=tool_name,
            arguments=arguments,
        )
    except RepositoryDataNotFoundError:
        return None


def _evidence_envelope(result: ToolResult) -> dict[str, Any]:
    if result.data_period is None:
        raise RuntimeError("successful visualization tool is missing its data period")
    return {
        "evidence_refs": result.evidence_refs,
        "data_period": result.data_period,
        "source": result.source,
        "updated_at": result.updated_at,
        "confidence": result.confidence,
        "limitations": result.limitations,
        "synthetic": result.synthetic,
    }
