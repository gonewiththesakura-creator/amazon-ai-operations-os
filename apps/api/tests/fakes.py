from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from amazon_ai_api.db.repositories.store_metrics import (
    AdsDailySummary,
    MetricSeriesData,
    MixBreakdownData,
    StoreDailySummary,
    TopEntitiesData,
)
from amazon_ai_api.models.visualizations import (
    EntityMetric,
    EntityType,
    MetricName,
    MetricSeriesPayload,
    MixBreakdownPayload,
    MixCategory,
    MixMetric,
    RankedEntity,
    TimeSeriesPoint,
    TopEntitiesPayload,
    VisualizationScope,
)


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

    def get_metric_series(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        metric: MetricName,
        lookback_days: int,
    ) -> MetricSeriesData:
        self.calls.append(("series", tenant_id, marketplace, business_date))
        values = {
            MetricName.ORDERS: (40.0, 43.0, 45.0),
            MetricName.SALES: (1410.0, 1485.0, 1520.5),
            MetricName.SESSIONS: (805.0, 782.0, 760.0),
            MetricName.CVR: (4.9689, 5.4987, 5.9211),
            MetricName.AD_SPEND: (176.0, 181.0, 190.0),
            MetricName.AD_SALES: (260.0, 245.0, 220.0),
            MetricName.ACOS: (67.6923, 73.8776, 86.3636),
            MetricName.CPC: (0.84, 0.88, 0.9048),
            MetricName.CTR: (1.02, 1.04, 1.05),
        }
        if metric not in values:
            from amazon_ai_api.db.repositories.store_metrics import RepositoryDataNotFoundError

            raise RepositoryDataNotFoundError(f"no fake series for {metric.value}")
        unit = (
            "USD" if metric in {MetricName.SALES, MetricName.AD_SPEND, MetricName.AD_SALES}
            else "USD_PER_CLICK" if metric is MetricName.CPC
            else "PERCENT" if metric in {MetricName.CVR, MetricName.ACOS, MetricName.CTR}
            else "COUNT"
        )
        points = tuple(
            TimeSeriesPoint(period=business_date - timedelta(days=2 - index), value=value)
            for index, value in enumerate(values[metric])
        )
        return MetricSeriesData(
            payload=MetricSeriesPayload(
                metric=metric,
                scope=VisualizationScope.STORE,
                unit=unit,
                lookback_days=lookback_days,
                maturity="PROVISIONAL" if metric.value.startswith("ad_") or metric in {MetricName.ACOS, MetricName.CPC, MetricName.CTR} else "MATURED",
                points=points,
            ),
            start_date=points[0].period,
            end_date=points[-1].period,
            **self._visualization_metadata(),
        )

    def get_top_entities(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        metric: EntityMetric,
        lookback_days: int,
        limit: int,
    ) -> TopEntitiesData:
        self.calls.append(("top_entities", tenant_id, marketplace, business_date))
        values = (720.0, 430.0, 240.0, 95.0, 35.5)[:limit]
        return TopEntitiesData(
            payload=TopEntitiesPayload(
                metric=metric,
                scope=VisualizationScope.STORE,
                entity_type=EntityType.ASIN,
                unit="USD" if metric is EntityMetric.SALES else "COUNT",
                lookback_days=lookback_days,
                entities=tuple(
                    RankedEntity(
                        rank=index,
                        entity_id=f"SYN-ASIN-{index:03d}",
                        label=f"Synthetic Product {index:02d}",
                        value=value,
                    )
                    for index, value in enumerate(values, start=1)
                ),
            ),
            start_date=business_date - timedelta(days=lookback_days - 1),
            end_date=business_date,
            **self._visualization_metadata(),
        )

    def get_mix_breakdown(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        metric: MixMetric,
        lookback_days: int,
        max_slices: int,
    ) -> MixBreakdownData:
        self.calls.append(("mix", tenant_id, marketplace, business_date))
        raw = (
            ("SYN-ASIN-001", "Synthetic Product 01", 50.0),
            ("SYN-ASIN-002", "Synthetic Product 02", 25.0),
            ("SYN-ASIN-003", "Synthetic Product 03", 15.0),
            ("SYN-ASIN-004", "Synthetic Product 04", 7.0),
            ("SYN-ASIN-005", "Synthetic Product 05", 2.0),
            ("SYN-ASIN-006", "Synthetic Product 06", 1.0),
        )
        visible = raw if len(raw) <= max_slices else raw[: max_slices - 1]
        categories = [
            MixCategory(entity_id=entity_id, label=label, value=value, share_pct=value)
            for entity_id, label, value in visible
        ]
        if len(raw) > max_slices:
            other = sum(item[2] for item in raw[max_slices - 1 :])
            categories.append(MixCategory(label="Other", value=other, share_pct=other))
        return MixBreakdownData(
            payload=MixBreakdownPayload(
                metric=metric,
                scope=VisualizationScope.STORE,
                entity_type=EntityType.ASIN,
                unit="USD" if metric is MixMetric.SALES else "COUNT",
                lookback_days=lookback_days,
                total=100,
                categories=tuple(categories),
            ),
            start_date=business_date - timedelta(days=lookback_days - 1),
            end_date=business_date,
            **self._visualization_metadata(),
        )

    @staticmethod
    def _visualization_metadata() -> dict[str, object]:
        return {
            "collected_at": datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
            "source_names": ("synthetic:test-sp-api",),
            "confidence": 1.0,
            "limitations": (),
            "synthetic": True,
        }
