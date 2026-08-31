import asyncio
from datetime import date

import pytest
from pydantic import ValidationError

from amazon_ai_api.adapters.synthetic import SyntheticAdapter
from amazon_ai_api.models.provenance import ProvenanceEnvelope
from amazon_ai_api.services.business_clock import BusinessClock
from conftest import TENANT_A
from fakes import FakeStoreMetricsRepository


def snapshot():
    return asyncio.run(
        SyntheticAdapter(
            repository=FakeStoreMetricsRepository(), business_clock=BusinessClock()
        ).read_home_snapshot(
            tenant_id=TENANT_A,
            marketplace="ATVPDKIKX0DER",
            business_date=date(2026, 8, 31),
        )
    )


def test_synthetic_adapter_separates_channel_from_data_semantics() -> None:
    result = snapshot()

    retail = result.provenance_by_domain["retail"]
    ads = result.provenance_by_domain["ads"]
    assert retail.source[0].source_kind == "SYNTHETIC"
    assert retail.source[0].semantic_source_kind == "FIRST_PARTY"
    assert ads.source[0].source_kind == "SYNTHETIC"
    assert ads.source[0].semantic_source_kind == "FIRST_PARTY"
    assert ads.attribution_window == "14_DAY_CLICK"
    assert retail.raw_record_reference


def test_provenance_rejects_synthetic_flag_channel_mismatch() -> None:
    result = snapshot()
    invalid = result.provenance_by_domain["retail"].model_dump(mode="json")
    invalid["source"][0]["source_kind"] = "LIVE_API"

    with pytest.raises(ValidationError, match="SYNTHETIC source_kind"):
        ProvenanceEnvelope.model_validate(invalid)


def test_provenance_rejects_invalid_currency_and_confidence() -> None:
    result = snapshot()
    invalid = result.provenance_by_domain["retail"].model_dump(mode="json")
    invalid["currency"] = "USDX"
    invalid["confidence"] = 1.1

    with pytest.raises(ValidationError):
        ProvenanceEnvelope.model_validate(invalid)
