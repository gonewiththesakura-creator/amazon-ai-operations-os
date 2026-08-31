from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from amazon_ai_api.db.repositories.store_metrics import AdsDailySummary, StoreDailySummary


class FakeStoreMetricsRepository:
    def __init__(self, *, anomaly: bool = True) -> None:
        self.anomaly = anomaly
        self.calls: list[tuple[str, UUID, str, date]] = []

    def get_store_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> StoreDailySummary:
        self.calls.append(("store", tenant_id, marketplace, business_date))
        return StoreDailySummary(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            sessions=760 if self.anomaly else 1000,
            orders=45 if self.anomaly else 101,
            units=46 if self.anomaly else 104,
            sales=Decimal("1520.50") if self.anomaly else Decimal("3490.20"),
            baseline_sessions=1000,
            baseline_orders=100,
            baseline_units=103,
            baseline_sales=Decimal("3400.00"),
            qualified_baseline_days=28,
            maturity="PROVISIONAL",
            collected_at=datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
            source_names=("synthetic:test-sp-api",),
            synthetic=True,
        )

    def get_ads_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> AdsDailySummary:
        self.calls.append(("ads", tenant_id, marketplace, business_date))
        return AdsDailySummary(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            impressions=20_000,
            clicks=210,
            spend=Decimal("190.00"),
            attributed_orders=8,
            attributed_sales=Decimal("220.00"),
            baseline_spend=Decimal("180.00"),
            baseline_attributed_sales=Decimal("520.00"),
            maturity="PROVISIONAL",
            attribution_window="14_DAY_CLICK",
            collected_at=datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
            source_names=("synthetic:test-ads-api",),
            synthetic=True,
        )

