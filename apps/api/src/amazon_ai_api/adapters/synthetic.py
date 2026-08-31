from __future__ import annotations

from datetime import date
from uuid import UUID

from amazon_ai_api.adapters.base import Adapter, AdapterDescriptor, HomeSnapshot
from amazon_ai_api.db.repositories.store_metrics import StoreMetricsRepository
from amazon_ai_api.models.home import HomeState
from amazon_ai_api.models.provenance import (
    DataPeriod,
    DateBasis,
    ProvenanceEnvelope,
    SemanticSourceKind,
    SourceKind,
    SourceReference,
)
from amazon_ai_api.services.analytics.store import (
    analyze_ads,
    compare_store_orders,
    detect_store_order_anomaly,
)
from amazon_ai_api.services.business_clock import BusinessClock


class SyntheticAdapter(Adapter):
    _descriptor = AdapterDescriptor(
        adapter_id="synthetic_postgres_m1",
        mode="SYNTHETIC",
        capabilities=("home_snapshot", "store_daily", "sp_ads_daily"),
    )

    def __init__(
        self, *, repository: StoreMetricsRepository, business_clock: BusinessClock
    ) -> None:
        self._repository = repository
        self._clock = business_clock

    @property
    def descriptor(self) -> AdapterDescriptor:
        return self._descriptor

    async def read_home_snapshot(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
    ) -> HomeSnapshot:
        store = self._repository.get_store_daily_summary(
            tenant_id=tenant_id, marketplace=marketplace, business_date=business_date
        )
        ads = self._repository.get_ads_daily_summary(
            tenant_id=tenant_id, marketplace=marketplace, business_date=business_date
        )
        comparison = compare_store_orders(store)
        anomaly = detect_store_order_anomaly(comparison)
        ad_metrics = analyze_ads(ads)
        collected_at = max(store.collected_at, ads.collected_at)
        period_start, period_end = self._clock.business_day_period(business_date)

        return HomeSnapshot(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            state=HomeState.ORDER_AD_ANOMALY if anomaly.detected else HomeState.NORMAL,
            collected_at=collected_at,
            sessions=store.sessions,
            orders=store.orders,
            units=store.units,
            sales=float(store.sales),
            baseline_orders=store.baseline_orders,
            baseline_sessions=store.baseline_sessions,
            baseline_units=store.baseline_units,
            ad_spend=float(ads.spend),
            ad_sales=float(ads.attributed_sales),
            positive_metric_value=comparison.current_cvr_pct,
            positive_metric_delta_pct=comparison.cvr_delta_pct,
            data_maturity=(
                "PROVISIONAL"
                if "PROVISIONAL" in {store.maturity, ads.maturity}
                else "MATURED"
            ),
            attribution_window=ads.attribution_window,
            provenance_by_domain={
                "retail": ProvenanceEnvelope(
                    source=tuple(
                        SourceReference(
                            name=source,
                            source_kind=SourceKind.SYNTHETIC,
                            semantic_source_kind=SemanticSourceKind.FIRST_PARTY,
                        )
                        for source in store.source_names
                    ),
                    collected_at=store.collected_at,
                    data_period=DataPeriod(start=period_start, end=period_end),
                    marketplace=marketplace,
                    timezone=self._clock.timezone_name,
                    currency="USD",
                    grain="STORE_DAY",
                    date_basis=DateBasis.ORDER_DATE,
                    attribution_window="NOT_APPLICABLE",
                    is_estimated=False,
                    synthetic=store.synthetic,
                    confidence=1.0,
                    limitations=(
                        f"Qualified baseline uses {store.qualified_baseline_days} matured days.",
                    ),
                    raw_record_reference=(
                        f"postgres:retail.fact_sales_traffic_daily:{tenant_id}:{business_date}",
                    ),
                ),
                "ads": ProvenanceEnvelope(
                    source=tuple(
                        SourceReference(
                            name=source,
                            source_kind=SourceKind.SYNTHETIC,
                            semantic_source_kind=SemanticSourceKind.FIRST_PARTY,
                        )
                        for source in ads.source_names
                    ),
                    collected_at=ads.collected_at,
                    data_period=DataPeriod(start=period_start, end=period_end),
                    marketplace=marketplace,
                    timezone=self._clock.timezone_name,
                    currency="USD",
                    grain="STORE_AD_DAY",
                    date_basis=DateBasis.TRAFFIC_DATE,
                    attribution_window=ads.attribution_window,
                    is_estimated=False,
                    synthetic=ads.synthetic,
                    confidence=1.0 if ads.maturity == "MATURED" else 0.78,
                    limitations=(
                        (
                            "Sponsored Products attribution is provisional until the 14-day window matures."
                            if ads.maturity == "PROVISIONAL"
                            else "Synthetic Sponsored Products data; not connected to an Amazon account."
                        ),
                    ),
                    raw_record_reference=(
                        f"postgres:ads.fact_sp_advertising_daily:{tenant_id}:{business_date}",
                    ),
                ),
            },
        )
