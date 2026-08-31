from datetime import date
from decimal import Decimal
from uuid import UUID

from amazon_ai_api.services.analytics.store import (
    analyze_ads,
    calculate_order_funnel,
    compare_store_orders,
    detect_store_order_anomaly,
)
from fakes import FakeStoreMetricsRepository


TENANT = UUID("00000000-0000-0000-0000-000000000001")


def test_orders_delta_is_deterministic() -> None:
    repository = FakeStoreMetricsRepository(anomaly=True)
    summary = repository.get_store_daily_summary(
        tenant_id=TENANT, marketplace="ATVPDKIKX0DER", business_date=date(2026, 8, 31)
    )

    comparison = compare_store_orders(summary)
    anomaly = detect_store_order_anomaly(comparison)
    funnel = calculate_order_funnel(summary)

    assert comparison.orders_delta_pct == -55.0
    assert comparison.sessions_delta_pct == -24.0
    assert comparison.cvr_delta_pct == -40.79
    assert anomaly.detected is True
    assert anomaly.contributing_signals == ("SESSIONS_DECLINE", "CVR_DECLINE")
    assert funnel.unit_session_percentage == 6.05


def test_ads_acos_is_calculated_not_supplied() -> None:
    repository = FakeStoreMetricsRepository()
    summary = repository.get_ads_daily_summary(
        tenant_id=TENANT, marketplace="ATVPDKIKX0DER", business_date=date(2026, 8, 31)
    )
    result = analyze_ads(summary)

    assert result.spend == Decimal("190.00")
    assert result.acos_pct == 86.36
    assert result.maturity == "PROVISIONAL"

