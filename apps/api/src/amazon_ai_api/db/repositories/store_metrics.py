from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.db.connection import Database
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


class RepositoryDataNotFoundError(LookupError):
    pass


class StoreDailySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    marketplace: str
    business_date: date
    sessions: int = Field(ge=0)
    orders: int = Field(ge=0)
    units: int = Field(ge=0)
    sales: Decimal = Field(ge=0)
    baseline_sessions: float = Field(ge=0)
    baseline_orders: float = Field(ge=0)
    baseline_units: float = Field(ge=0)
    baseline_sales: Decimal = Field(ge=0)
    qualified_baseline_days: int = Field(ge=0)
    maturity: str
    collected_at: datetime
    source_names: tuple[str, ...] = Field(min_length=1)
    synthetic: bool


class AdsDailySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    marketplace: str
    business_date: date
    impressions: int = Field(ge=0)
    clicks: int = Field(ge=0)
    spend: Decimal = Field(ge=0)
    attributed_orders: int = Field(ge=0)
    attributed_sales: Decimal = Field(ge=0)
    baseline_spend: Decimal = Field(ge=0)
    baseline_attributed_sales: Decimal = Field(ge=0)
    maturity: str
    attribution_window: str
    collected_at: datetime
    source_names: tuple[str, ...] = Field(min_length=1)
    synthetic: bool


class VisualizationRepositoryData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_date: date
    end_date: date
    collected_at: datetime
    source_names: tuple[str, ...] = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    limitations: tuple[str, ...]
    synthetic: bool


class MetricSeriesData(VisualizationRepositoryData):
    payload: MetricSeriesPayload


class TopEntitiesData(VisualizationRepositoryData):
    payload: TopEntitiesPayload


class MixBreakdownData(VisualizationRepositoryData):
    payload: MixBreakdownPayload


class StoreMetricsRepository(Protocol):
    def get_store_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> StoreDailySummary: ...

    def get_ads_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> AdsDailySummary: ...

    def get_metric_series(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        metric: MetricName,
        lookback_days: int,
    ) -> MetricSeriesData: ...

    def get_top_entities(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        metric: EntityMetric,
        lookback_days: int,
        limit: int,
    ) -> TopEntitiesData: ...

    def get_mix_breakdown(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        metric: MixMetric,
        lookback_days: int,
        max_slices: int,
    ) -> MixBreakdownData: ...


class PostgresStoreMetricsRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    def get_store_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> StoreDailySummary:
        query = """
            WITH daily AS (
              SELECT
                fact.business_date,
                SUM(fact.sessions)::bigint AS sessions,
                SUM(fact.orders)::bigint AS orders,
                SUM(fact.units_ordered)::bigint AS units,
                SUM(fact.ordered_product_sales)::numeric AS sales,
                CASE WHEN BOOL_AND(fact.maturity = 'MATURED') THEN 'MATURED' ELSE 'PROVISIONAL' END AS maturity,
                BOOL_AND(fact.synthetic) AS synthetic,
                MAX(provenance.collected_at) AS collected_at,
                ARRAY_AGG(DISTINCT provenance.source) AS source_names
              FROM retail.fact_sales_traffic_daily fact
              JOIN connectors.marketplace_accounts account
                ON account.tenant_id = fact.tenant_id AND account.account_id = fact.account_id
              JOIN connectors.data_provenance provenance
                ON provenance.tenant_id = fact.tenant_id AND provenance.provenance_id = fact.provenance_id
              WHERE fact.tenant_id = %(tenant_id)s
                AND account.marketplace = %(marketplace)s
                AND fact.business_date BETWEEN %(business_date)s::date - 28 AND %(business_date)s::date
              GROUP BY fact.business_date
            ), baseline AS (
              SELECT
                AVG(sessions)::double precision AS sessions,
                AVG(orders)::double precision AS orders,
                AVG(units)::double precision AS units,
                AVG(sales)::numeric AS sales,
                COUNT(*)::integer AS qualified_days
              FROM daily
              WHERE business_date < %(business_date)s::date AND maturity = 'MATURED'
            )
            SELECT current.*, baseline.sessions AS baseline_sessions,
              baseline.orders AS baseline_orders, baseline.units AS baseline_units,
              baseline.sales AS baseline_sales, baseline.qualified_days
            FROM daily current CROSS JOIN baseline
            WHERE current.business_date = %(business_date)s::date
        """
        with self._database.tenant_connection(tenant_id) as connection:
            row = connection.execute(
                query,
                {"tenant_id": tenant_id, "marketplace": marketplace, "business_date": business_date},
            ).fetchone()
        if row is None:
            raise RepositoryDataNotFoundError(
                f"no store metrics for tenant={tenant_id} marketplace={marketplace} date={business_date}"
            )
        return StoreDailySummary(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            sessions=row["sessions"],
            orders=row["orders"],
            units=row["units"],
            sales=row["sales"],
            baseline_sessions=row["baseline_sessions"] or 0,
            baseline_orders=row["baseline_orders"] or 0,
            baseline_units=row["baseline_units"] or 0,
            baseline_sales=row["baseline_sales"] or 0,
            qualified_baseline_days=row["qualified_days"],
            maturity=row["maturity"],
            collected_at=row["collected_at"],
            source_names=tuple(row["source_names"]),
            synthetic=row["synthetic"],
        )

    def get_ads_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> AdsDailySummary:
        query = """
            WITH daily AS (
              SELECT fact.business_date, SUM(fact.impressions)::bigint AS impressions,
                SUM(fact.clicks)::bigint AS clicks, SUM(fact.spend)::numeric AS spend,
                SUM(fact.attributed_orders)::bigint AS attributed_orders,
                SUM(fact.attributed_sales)::numeric AS attributed_sales,
                CASE WHEN BOOL_AND(fact.maturity = 'MATURED') THEN 'MATURED' ELSE 'PROVISIONAL' END AS maturity,
                MAX(fact.attribution_window) AS attribution_window,
                BOOL_AND(fact.synthetic) AS synthetic,
                MAX(provenance.collected_at) AS collected_at,
                ARRAY_AGG(DISTINCT provenance.source) AS source_names
              FROM ads.fact_sp_advertising_daily fact
              JOIN connectors.marketplace_accounts account
                ON account.tenant_id = fact.tenant_id AND account.account_id = fact.account_id
              JOIN connectors.data_provenance provenance
                ON provenance.tenant_id = fact.tenant_id AND provenance.provenance_id = fact.provenance_id
              WHERE fact.tenant_id = %(tenant_id)s
                AND account.marketplace = %(marketplace)s
                AND fact.business_date BETWEEN %(business_date)s::date - 28 AND %(business_date)s::date
              GROUP BY fact.business_date
            ), baseline AS (
              SELECT AVG(spend)::numeric AS spend, AVG(attributed_sales)::numeric AS attributed_sales
              FROM daily WHERE business_date < %(business_date)s::date AND maturity = 'MATURED'
            )
            SELECT current.*, baseline.spend AS baseline_spend,
              baseline.attributed_sales AS baseline_attributed_sales
            FROM daily current CROSS JOIN baseline
            WHERE current.business_date = %(business_date)s::date
        """
        with self._database.tenant_connection(tenant_id) as connection:
            row = connection.execute(
                query,
                {"tenant_id": tenant_id, "marketplace": marketplace, "business_date": business_date},
            ).fetchone()
        if row is None:
            raise RepositoryDataNotFoundError(
                f"no Sponsored Products metrics for tenant={tenant_id} marketplace={marketplace} date={business_date}"
            )
        return AdsDailySummary(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            impressions=row["impressions"],
            clicks=row["clicks"],
            spend=row["spend"],
            attributed_orders=row["attributed_orders"],
            attributed_sales=row["attributed_sales"],
            baseline_spend=row["baseline_spend"] or 0,
            baseline_attributed_sales=row["baseline_attributed_sales"] or 0,
            maturity=row["maturity"],
            attribution_window=row["attribution_window"],
            collected_at=row["collected_at"],
            source_names=tuple(row["source_names"]),
            synthetic=row["synthetic"],
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
        retail_expressions = {
            MetricName.ORDERS: "SUM(fact.orders)::numeric",
            MetricName.SALES: "SUM(fact.ordered_product_sales)::numeric",
            MetricName.SESSIONS: "SUM(fact.sessions)::numeric",
            MetricName.CVR: (
                "CASE WHEN SUM(fact.sessions) > 0 "
                "THEN SUM(fact.orders)::numeric * 100 / SUM(fact.sessions) ELSE NULL END"
            ),
        }
        ad_expressions = {
            MetricName.AD_SPEND: "SUM(fact.spend)::numeric",
            MetricName.AD_SALES: "SUM(fact.attributed_sales)::numeric",
            MetricName.ACOS: (
                "CASE WHEN SUM(fact.attributed_sales) > 0 "
                "THEN SUM(fact.spend) * 100 / SUM(fact.attributed_sales) ELSE NULL END"
            ),
            MetricName.CPC: (
                "CASE WHEN SUM(fact.clicks) > 0 "
                "THEN SUM(fact.spend) / SUM(fact.clicks) ELSE NULL END"
            ),
            MetricName.CTR: (
                "CASE WHEN SUM(fact.impressions) > 0 "
                "THEN SUM(fact.clicks)::numeric * 100 / SUM(fact.impressions) ELSE NULL END"
            ),
        }
        if metric in retail_expressions:
            table = "retail.fact_sales_traffic_daily"
            expression = retail_expressions[metric]
        elif metric in ad_expressions:
            table = "ads.fact_sp_advertising_daily"
            expression = ad_expressions[metric]
        else:
            raise RepositoryDataNotFoundError(
                f"no PostgreSQL series is available for metric={metric.value}"
            )
        query = f"""
            WITH points AS (
              SELECT fact.business_date AS period,
                {expression} AS value,
                CASE WHEN BOOL_AND(fact.maturity = 'MATURED')
                  THEN 'MATURED' ELSE 'PROVISIONAL' END AS maturity,
                BOOL_AND(fact.synthetic) AS synthetic,
                MAX(provenance.collected_at) AS collected_at,
                ARRAY_AGG(DISTINCT provenance.source) AS source_names
              FROM {table} fact
              JOIN connectors.marketplace_accounts account
                ON account.tenant_id = fact.tenant_id AND account.account_id = fact.account_id
              JOIN connectors.data_provenance provenance
                ON provenance.tenant_id = fact.tenant_id
                AND provenance.provenance_id = fact.provenance_id
              WHERE fact.tenant_id = %(tenant_id)s
                AND account.marketplace = %(marketplace)s
                AND fact.business_date BETWEEN
                  %(business_date)s::date - (%(lookback_days)s::integer - 1)
                  AND %(business_date)s::date
              GROUP BY fact.business_date
            )
            SELECT * FROM points WHERE value IS NOT NULL ORDER BY period
        """
        with self._database.tenant_connection(tenant_id) as connection:
            rows = connection.execute(
                query,
                {
                    "tenant_id": tenant_id,
                    "marketplace": marketplace,
                    "business_date": business_date,
                    "lookback_days": lookback_days,
                },
            ).fetchall()
        if not rows:
            raise RepositoryDataNotFoundError(
                f"no {metric.value} series for tenant={tenant_id} marketplace={marketplace}"
            )
        maturity = "PROVISIONAL" if any(row["maturity"] == "PROVISIONAL" for row in rows) else "MATURED"
        payload = MetricSeriesPayload(
            metric=metric,
            scope=VisualizationScope.STORE,
            unit=_metric_unit(metric),
            lookback_days=lookback_days,
            maturity=maturity,
            points=tuple(
                TimeSeriesPoint(period=row["period"], value=round(float(row["value"]), 4))
                for row in rows
            ),
        )
        limitations = (
            ("Current Sponsored Products values remain provisional within the attribution window.",)
            if metric in ad_expressions and maturity == "PROVISIONAL"
            else ()
        )
        return MetricSeriesData(
            payload=payload,
            start_date=rows[0]["period"],
            end_date=rows[-1]["period"],
            **_visualization_metadata(rows, limitations=limitations),
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
        expression = {
            EntityMetric.ORDERS: "SUM(fact.orders)::numeric",
            EntityMetric.SALES: "SUM(fact.ordered_product_sales)::numeric",
            EntityMetric.SESSIONS: "SUM(fact.sessions)::numeric",
        }[metric]
        rows = self._read_asin_aggregates(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            lookback_days=lookback_days,
            expression=expression,
            limit=limit,
        )
        if not rows:
            raise RepositoryDataNotFoundError(
                f"no ASIN entities for metric={metric.value} tenant={tenant_id}"
            )
        return TopEntitiesData(
            payload=TopEntitiesPayload(
                metric=metric,
                scope=VisualizationScope.STORE,
                entity_type=EntityType.ASIN,
                unit=_metric_unit(metric),
                lookback_days=lookback_days,
                entities=tuple(
                    RankedEntity(
                        rank=index,
                        entity_id=row["asin"],
                        label=row["title"],
                        value=round(float(row["value"]), 4),
                    )
                    for index, row in enumerate(rows, start=1)
                ),
            ),
            start_date=business_date - timedelta(days=lookback_days - 1),
            end_date=business_date,
            **_visualization_metadata(rows),
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
        expression = {
            MixMetric.ORDERS: "SUM(fact.orders)::numeric",
            MixMetric.SALES: "SUM(fact.ordered_product_sales)::numeric",
        }[metric]
        rows = self._read_asin_aggregates(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
            lookback_days=lookback_days,
            expression=expression,
            limit=None,
        )
        total = sum((Decimal(str(row["value"])) for row in rows), start=Decimal(0))
        if total <= 0:
            raise RepositoryDataNotFoundError(
                f"no positive ASIN mix for metric={metric.value} tenant={tenant_id}"
            )
        visible_count = max_slices if len(rows) <= max_slices else max_slices - 1
        categories = [
            MixCategory(
                entity_id=row["asin"],
                label=row["title"],
                value=round(float(row["value"]), 4),
                share_pct=round(float(Decimal(str(row["value"])) / total * 100), 4),
            )
            for row in rows[:visible_count]
        ]
        if len(rows) > max_slices:
            other = sum(
                (Decimal(str(row["value"])) for row in rows[visible_count:]),
                start=Decimal(0),
            )
            categories.append(
                MixCategory(
                    label="Other",
                    value=round(float(other), 4),
                    share_pct=round(float(other / total * 100), 4),
                )
            )
        return MixBreakdownData(
            payload=MixBreakdownPayload(
                metric=metric,
                scope=VisualizationScope.STORE,
                entity_type=EntityType.ASIN,
                unit=_metric_unit(metric),
                lookback_days=lookback_days,
                total=round(float(total), 4),
                categories=tuple(categories),
            ),
            start_date=business_date - timedelta(days=lookback_days - 1),
            end_date=business_date,
            **_visualization_metadata(rows),
        )

    def _read_asin_aggregates(
        self,
        *,
        tenant_id: UUID,
        marketplace: str,
        business_date: date,
        lookback_days: int,
        expression: str,
        limit: int | None,
    ) -> list[dict]:
        limit_clause = "LIMIT %(limit)s" if limit is not None else ""
        query = f"""
            SELECT product.asin, product.title, {expression} AS value,
              BOOL_AND(fact.synthetic) AS synthetic,
              MAX(provenance.collected_at) AS collected_at,
              ARRAY_AGG(DISTINCT provenance.source) AS source_names
            FROM retail.fact_sales_traffic_daily fact
            JOIN connectors.marketplace_accounts account
              ON account.tenant_id = fact.tenant_id AND account.account_id = fact.account_id
            JOIN catalog.products product
              ON product.tenant_id = fact.tenant_id AND product.product_id = fact.product_id
            JOIN connectors.data_provenance provenance
              ON provenance.tenant_id = fact.tenant_id
              AND provenance.provenance_id = fact.provenance_id
            WHERE fact.tenant_id = %(tenant_id)s
              AND account.marketplace = %(marketplace)s
              AND fact.business_date BETWEEN
                %(business_date)s::date - (%(lookback_days)s::integer - 1)
                AND %(business_date)s::date
            GROUP BY product.asin, product.title
            HAVING {expression} > 0
            ORDER BY value DESC, product.asin
            {limit_clause}
        """
        parameters = {
            "tenant_id": tenant_id,
            "marketplace": marketplace,
            "business_date": business_date,
            "lookback_days": lookback_days,
        }
        if limit is not None:
            parameters["limit"] = limit
        with self._database.tenant_connection(tenant_id) as connection:
            return list(connection.execute(query, parameters).fetchall())


def _metric_unit(metric: MetricName | EntityMetric | MixMetric) -> str:
    if metric in {MetricName.SALES, MetricName.AD_SPEND, MetricName.AD_SALES, MetricName.CONTRIBUTION_PROFIT}:
        return "USD"
    if metric in {MetricName.CVR, MetricName.ACOS, MetricName.CTR}:
        return "PERCENT"
    if metric is MetricName.CPC:
        return "USD_PER_CLICK"
    if metric is MetricName.INVENTORY_DAYS:
        return "DAYS"
    return "COUNT"


def _visualization_metadata(
    rows: list[dict], *, limitations: tuple[str, ...] = ()
) -> dict[str, object]:
    return {
        "collected_at": max(row["collected_at"] for row in rows),
        "source_names": tuple(
            sorted({source for row in rows for source in row["source_names"]})
        ),
        "confidence": 1.0,
        "limitations": limitations,
        "synthetic": all(bool(row["synthetic"]) for row in rows),
    }
