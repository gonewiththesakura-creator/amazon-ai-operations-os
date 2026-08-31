from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from uuid import NAMESPACE_URL, UUID, uuid5

from amazon_ai_api.adapters.base import Adapter, AdapterDescriptor, HomeSnapshot
from amazon_ai_api.models.home import HomeState
from amazon_ai_api.models.provenance import (
    DataPeriod,
    DateBasis,
    ProvenanceEnvelope,
    SemanticSourceKind,
    SourceKind,
    SourceReference,
)


class SyntheticAdapter(Adapter):
    _descriptor = AdapterDescriptor(
        adapter_id="synthetic_m0",
        mode="SYNTHETIC",
        capabilities=("home_snapshot", "store_daily", "ads_daily", "market_signals"),
    )

    @property
    def descriptor(self) -> AdapterDescriptor:
        return self._descriptor

    async def read_home_snapshot(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        state: HomeState,
    ) -> HomeSnapshot:
        if state not in {HomeState.NORMAL, HomeState.ORDER_AD_ANOMALY}:
            raise ValueError(f"synthetic M0 adapter does not implement state: {state.value}")

        collected_at = datetime.combine(business_date + timedelta(days=1), time(8), timezone.utc)
        provenance = self._build_provenance(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            collected_at=collected_at,
        )
        if state is HomeState.NORMAL:
            values = {
                "sessions": 548,
                "orders": 26,
                "units": 28,
                "sales": 1117.72,
                "baseline_orders": 23,
                "ad_spend": 126.48,
                "ad_sales": 421.37,
                "positive_metric_value": 5.11,
                "positive_metric_delta_pct": 8.72,
                "competitor_count": 4,
                "product_candidate_count": 3,
                "product_opportunity_score": 78.0,
            }
        else:
            values = {
                "sessions": 302,
                "orders": 9,
                "units": 9,
                "sales": 374.91,
                "baseline_orders": 24,
                "ad_spend": 191.36,
                "ad_sales": 212.58,
                "positive_metric_value": 3.44,
                "positive_metric_delta_pct": -22.7,
                "competitor_count": 4,
                "product_candidate_count": 2,
                "product_opportunity_score": 66.0,
            }
        return HomeSnapshot(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            state=state,
            collected_at=collected_at,
            provenance_by_domain=provenance,
            **values,
        )

    @staticmethod
    def _build_provenance(
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        collected_at: datetime,
    ) -> dict[str, ProvenanceEnvelope]:
        start = datetime.combine(business_date, time.min, timezone.utc)
        end = datetime.combine(business_date, time.max, timezone.utc)
        period = DataPeriod(start=start, end=end)

        def envelope(
            domain: str,
            source_name: str,
            grain: str,
            date_basis: DateBasis,
            attribution_window: str,
            *,
            estimated: bool = False,
            semantic_kind: SemanticSourceKind = SemanticSourceKind.FIRST_PARTY,
            confidence: float = 1.0,
        ) -> ProvenanceEnvelope:
            record_id = uuid5(
                NAMESPACE_URL,
                f"{tenant_id}:{marketplace}:{business_date.isoformat()}:{domain}",
            )
            return ProvenanceEnvelope(
                source=(
                    SourceReference(
                        name=source_name,
                        source_kind=SourceKind.SYNTHETIC,
                        semantic_source_kind=semantic_kind,
                    ),
                ),
                collected_at=collected_at,
                data_period=period,
                marketplace=marketplace,
                timezone="America/Los_Angeles",
                currency="USD",
                grain=grain,
                date_basis=date_basis,
                attribution_window=attribution_window,
                is_estimated=estimated,
                synthetic=True,
                confidence=confidence,
                limitations=("Synthetic M0 fixture; not connected to an Amazon account.",),
                raw_record_reference=(f"raw:synthetic:{record_id}",),
            )

        return {
            "retail": envelope(
                "retail",
                "synthetic-sp-api",
                "STORE_DAY",
                DateBasis.ORDER_DATE,
                "NOT_APPLICABLE",
            ),
            "ads": envelope(
                "ads",
                "synthetic-amazon-ads",
                "STORE_TRAFFIC_DAY",
                DateBasis.TRAFFIC_DATE,
                "14_DAY_CLICK",
            ),
            "market": envelope(
                "market",
                "synthetic-market-fixture",
                "MARKETPLACE_DAY",
                DateBasis.SNAPSHOT_TIME,
                "NOT_APPLICABLE",
                estimated=True,
                semantic_kind=SemanticSourceKind.THIRD_PARTY_ESTIMATE,
                confidence=0.78,
            ),
        }
