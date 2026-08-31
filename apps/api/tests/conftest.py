from collections.abc import Iterator
from datetime import datetime, timezone
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from amazon_ai_api.main import create_app
from amazon_ai_api.config import Settings
from fakes import FakeStoreMetricsRepository


TENANT_A = UUID("11111111-1111-4111-8111-111111111111")
TENANT_B = UUID("22222222-2222-4222-8222-222222222222")


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(
        settings=Settings(database_url="postgresql://unused"),
        repository=FakeStoreMetricsRepository(),
        logical_now=datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def tenant_headers() -> dict[str, str]:
    return {"X-Tenant-Id": str(TENANT_A)}
