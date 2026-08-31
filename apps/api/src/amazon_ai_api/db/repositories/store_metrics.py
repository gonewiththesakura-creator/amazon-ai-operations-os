from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.db.connection import Database


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


class StoreMetricsRepository(Protocol):
    def get_store_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> StoreDailySummary: ...

    def get_ads_daily_summary(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> AdsDailySummary: ...


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

