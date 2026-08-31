from collections.abc import Iterator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from amazon_ai_api.main import create_app


TENANT_A = UUID("11111111-1111-4111-8111-111111111111")
TENANT_B = UUID("22222222-2222-4222-8222-222222222222")


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def tenant_headers() -> dict[str, str]:
    return {"X-Tenant-Id": str(TENANT_A)}

