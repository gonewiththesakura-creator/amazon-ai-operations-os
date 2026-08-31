from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.db.repositories.store_metrics import AdsDailySummary, StoreDailySummary


def _delta(current: float, baseline: float) -> float:
    if baseline == 0:
        return 0.0
    return round((current - baseline) / baseline * 100, 2)


class StoreAnalyticsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_orders: int = Field(ge=0)
    baseline_orders: float = Field(ge=0)
    orders_delta_pct: float
    current_sessions: int = Field(ge=0)
    baseline_sessions: float = Field(ge=0)
    sessions_delta_pct: float
    current_cvr_pct: float = Field(ge=0)
    baseline_cvr_pct: float = Field(ge=0)
    cvr_delta_pct: float
    qualified_baseline_days: int = Field(ge=0)


class OrderFunnelResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessions: int = Field(ge=0)
    orders: int = Field(ge=0)
    units: int = Field(ge=0)
    unit_session_percentage: float = Field(ge=0)
    baseline_sessions: float = Field(ge=0)
    baseline_orders: float = Field(ge=0)
    baseline_unit_session_percentage: float = Field(ge=0)


class AnomalyResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detected: bool
    severity: str
    metric: str
    observed_value: float
    baseline_value: float
    delta_pct: float
    threshold_pct: float
    contributing_signals: tuple[str, ...]


class AdAnalyticsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spend: Decimal = Field(ge=0)
    attributed_sales: Decimal = Field(ge=0)
    acos_pct: float | None
    baseline_spend: Decimal = Field(ge=0)
    baseline_attributed_sales: Decimal = Field(ge=0)
    spend_delta_pct: float
    attributed_sales_delta_pct: float
    maturity: str
    attribution_window: str


def compare_store_orders(summary: StoreDailySummary) -> StoreAnalyticsResult:
    current_cvr = summary.orders / summary.sessions * 100 if summary.sessions else 0.0
    baseline_cvr = (
        summary.baseline_orders / summary.baseline_sessions * 100
        if summary.baseline_sessions
        else 0.0
    )
    return StoreAnalyticsResult(
        current_orders=summary.orders,
        baseline_orders=round(summary.baseline_orders, 2),
        orders_delta_pct=_delta(summary.orders, summary.baseline_orders),
        current_sessions=summary.sessions,
        baseline_sessions=round(summary.baseline_sessions, 2),
        sessions_delta_pct=_delta(summary.sessions, summary.baseline_sessions),
        current_cvr_pct=round(current_cvr, 2),
        baseline_cvr_pct=round(baseline_cvr, 2),
        cvr_delta_pct=_delta(current_cvr, baseline_cvr),
        qualified_baseline_days=summary.qualified_baseline_days,
    )


def calculate_order_funnel(summary: StoreDailySummary) -> OrderFunnelResult:
    return OrderFunnelResult(
        sessions=summary.sessions,
        orders=summary.orders,
        units=summary.units,
        unit_session_percentage=round(summary.units / summary.sessions * 100, 2) if summary.sessions else 0.0,
        baseline_sessions=round(summary.baseline_sessions, 2),
        baseline_orders=round(summary.baseline_orders, 2),
        baseline_unit_session_percentage=(
            round(summary.baseline_units / summary.baseline_sessions * 100, 2)
            if summary.baseline_sessions
            else 0.0
        ),
    )


def detect_store_order_anomaly(
    comparison: StoreAnalyticsResult, *, threshold_pct: float = -20.0
) -> AnomalyResult:
    detected = comparison.qualified_baseline_days >= 7 and comparison.orders_delta_pct <= threshold_pct
    signals: list[str] = []
    if comparison.sessions_delta_pct <= -10:
        signals.append("SESSIONS_DECLINE")
    if comparison.cvr_delta_pct <= -10:
        signals.append("CVR_DECLINE")
    if not signals and detected:
        signals.append("UNEXPLAINED_ORDER_DECLINE")
    severity = "CRITICAL" if comparison.orders_delta_pct <= -35 else "WARNING" if detected else "INFO"
    return AnomalyResult(
        detected=detected,
        severity=severity,
        metric="orders",
        observed_value=float(comparison.current_orders),
        baseline_value=comparison.baseline_orders,
        delta_pct=comparison.orders_delta_pct,
        threshold_pct=threshold_pct,
        contributing_signals=tuple(signals),
    )


def analyze_ads(summary: AdsDailySummary) -> AdAnalyticsResult:
    attributed_sales = float(summary.attributed_sales)
    return AdAnalyticsResult(
        spend=summary.spend,
        attributed_sales=summary.attributed_sales,
        acos_pct=round(float(summary.spend) / attributed_sales * 100, 2) if attributed_sales else None,
        baseline_spend=summary.baseline_spend,
        baseline_attributed_sales=summary.baseline_attributed_sales,
        spend_delta_pct=_delta(float(summary.spend), float(summary.baseline_spend)),
        attributed_sales_delta_pct=_delta(
            float(summary.attributed_sales), float(summary.baseline_attributed_sales)
        ),
        maturity=summary.maturity,
        attribution_window=summary.attribution_window,
    )

