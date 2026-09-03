from __future__ import annotations

import os
from datetime import date
from uuid import UUID

import pytest

from amazon_ai_api.db.connection import Database
from amazon_ai_api.db.repositories.store_metrics import (
    PostgresStoreMetricsRepository,
    RepositoryDataNotFoundError,
)
from amazon_ai_api.models.visualizations import EntityMetric, MetricName, MixMetric


DATABASE_URL = os.getenv("TEST_DATABASE_URL")
DEMO_TENANT = UUID("00000000-0000-0000-0000-000000000001")
OTHER_TENANT = UUID("22222222-2222-4222-8222-222222222222")


@pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL is not configured")
def test_synthetic_database_has_m1_store_data() -> None:
    repository = PostgresStoreMetricsRepository(Database(DATABASE_URL or ""))
    summary = repository.get_store_daily_summary(
        tenant_id=DEMO_TENANT,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
    )

    assert summary.synthetic is True
    assert summary.qualified_baseline_days == 28
    assert summary.orders == 133
    assert round(summary.baseline_orders, 2) == 269.43
    assert summary.source_names == ("synthetic:amazon_sp_api",)


@pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL is not configured")
def test_repository_never_returns_another_tenants_rows() -> None:
    repository = PostgresStoreMetricsRepository(Database(DATABASE_URL or ""))
    with pytest.raises(RepositoryDataNotFoundError):
        repository.get_store_daily_summary(
            tenant_id=OTHER_TENANT,
            marketplace="ATVPDKIKX0DER",
            business_date=date(2026, 8, 31),
        )

    with pytest.raises(RepositoryDataNotFoundError):
        repository.get_metric_series(
            tenant_id=OTHER_TENANT,
            marketplace="ATVPDKIKX0DER",
            business_date=date(2026, 8, 31),
            metric=MetricName.ORDERS,
            lookback_days=7,
        )


@pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL is not configured")
def test_synthetic_database_supplies_visualization_series_and_asin_breakdowns() -> None:
    repository = PostgresStoreMetricsRepository(Database(DATABASE_URL or ""))

    series = repository.get_metric_series(
        tenant_id=DEMO_TENANT,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
        metric=MetricName.ORDERS,
        lookback_days=7,
    )
    top = repository.get_top_entities(
        tenant_id=DEMO_TENANT,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
        metric=EntityMetric.SALES,
        lookback_days=30,
        limit=5,
    )
    mix = repository.get_mix_breakdown(
        tenant_id=DEMO_TENANT,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
        metric=MixMetric.SALES,
        lookback_days=30,
        max_slices=5,
    )

    assert len(series.payload.points) == 7
    assert series.payload.points[-1].period == date(2026, 8, 31)
    assert series.payload.points[-1].value == 133
    assert len(top.payload.entities) == 5
    assert [item.value for item in top.payload.entities] == sorted(
        (item.value for item in top.payload.entities), reverse=True
    )
    assert len(mix.payload.categories) == 5
    assert mix.payload.categories[-1].label == "Other"
    assert sum(item.share_pct for item in mix.payload.categories) == pytest.approx(100)
