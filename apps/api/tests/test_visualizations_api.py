from datetime import datetime, timezone

from fastapi.testclient import TestClient

from amazon_ai_api.config import Settings
from amazon_ai_api.db.repositories.store_metrics import RepositoryDataNotFoundError
from amazon_ai_api.main import create_app
from conftest import TENANT_A
from fakes import FakeStoreMetricsRepository


def test_home_visualizations_are_typed_bounded_and_evidence_backed(
    client: TestClient, tenant_headers: dict[str, str]
) -> None:
    response = client.get(
        "/v1/visualizations/home",
        headers=tenant_headers,
        params={"business_date": "2026-08-31", "lookback_days": 30},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["business_date"] == "2026-08-31"
    assert body["lookback_days"] == 30
    assert body["synthetic"] is True
    assert [item["metric"] for item in body["metric_series"]] == [
        "orders",
        "sales",
        "sessions",
        "cvr",
        "ad_spend",
        "ad_sales",
        "acos",
        "cpc",
        "ctr",
    ]
    assert all(len(item["points"]) == 3 for item in body["metric_series"])
    assert all(item["evidence_refs"] for item in body["metric_series"])
    assert all(item["source"] for item in body["metric_series"])
    assert body["top_entities"][0]["metric"] == "sales"
    assert len(body["top_entities"][0]["entities"]) == 5
    assert body["mix_breakdowns"][0]["metric"] == "sales"
    assert len(body["mix_breakdowns"][0]["categories"]) <= 5
    assert not any(item["metric"].startswith("ad_") for item in body["top_entities"])


class MissingVisualizationRepository(FakeStoreMetricsRepository):
    def get_metric_series(self, **kwargs):
        raise RepositoryDataNotFoundError("series unavailable")

    def get_top_entities(self, **kwargs):
        raise RepositoryDataNotFoundError("entities unavailable")

    def get_mix_breakdown(self, **kwargs):
        raise RepositoryDataNotFoundError("mix unavailable")


def test_missing_data_omits_visualizations_instead_of_zero_filling() -> None:
    app = create_app(
        settings=Settings(database_url="postgresql://unused"),
        repository=MissingVisualizationRepository(),
        logical_now=datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
    )

    with TestClient(app) as client:
        response = client.get(
            "/v1/visualizations/home",
            headers={"X-Tenant-Id": str(TENANT_A)},
        )

    assert response.status_code == 200
    assert response.json() == {
        "business_date": "2026-08-31",
        "marketplace": "ATVPDKIKX0DER",
        "lookback_days": 30,
        "metric_series": [],
        "top_entities": [],
        "mix_breakdowns": [],
        "synthetic": True,
    }


def test_home_visualization_lookback_is_bounded(
    client: TestClient, tenant_headers: dict[str, str]
) -> None:
    response = client.get(
        "/v1/visualizations/home",
        headers=tenant_headers,
        params={"lookback_days": 91},
    )

    assert response.status_code == 422
