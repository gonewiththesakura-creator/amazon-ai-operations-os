import asyncio
from datetime import date

import pytest
from pydantic import ValidationError

from amazon_ai_api.adapters.synthetic import SyntheticAdapter
from amazon_ai_api.models.home import HomeState
from amazon_ai_api.models.provenance import ProvenanceEnvelope
from conftest import TENANT_A


def test_synthetic_adapter_separates_channel_from_data_semantics() -> None:
    snapshot = asyncio.run(
        SyntheticAdapter().read_home_snapshot(
            tenant_id=TENANT_A,
            marketplace="ATVPDKIKX0DER",
            business_date=date(2026, 8, 30),
            state=HomeState.NORMAL,
        )
    )

    retail = snapshot.provenance_by_domain["retail"]
    market = snapshot.provenance_by_domain["market"]
    assert retail.source[0].source_kind == "SYNTHETIC"
    assert retail.source[0].semantic_source_kind == "FIRST_PARTY"
    assert market.source[0].source_kind == "SYNTHETIC"
    assert market.source[0].semantic_source_kind == "THIRD_PARTY_ESTIMATE"
    assert market.is_estimated is True
    assert retail.raw_record_reference


def test_provenance_rejects_synthetic_flag_channel_mismatch() -> None:
    snapshot = asyncio.run(
        SyntheticAdapter().read_home_snapshot(
            tenant_id=TENANT_A,
            marketplace="ATVPDKIKX0DER",
            business_date=date(2026, 8, 30),
            state=HomeState.NORMAL,
        )
    )
    invalid = snapshot.provenance_by_domain["retail"].model_dump(mode="json")
    invalid["source"][0]["source_kind"] = "LIVE_API"

    with pytest.raises(ValidationError, match="SYNTHETIC source_kind"):
        ProvenanceEnvelope.model_validate(invalid)


def test_provenance_rejects_invalid_currency_and_confidence() -> None:
    snapshot = asyncio.run(
        SyntheticAdapter().read_home_snapshot(
            tenant_id=TENANT_A,
            marketplace="ATVPDKIKX0DER",
            business_date=date(2026, 8, 30),
            state=HomeState.NORMAL,
        )
    )
    invalid = snapshot.provenance_by_domain["retail"].model_dump(mode="json")
    invalid["currency"] = "USDX"
    invalid["confidence"] = 1.1

    with pytest.raises(ValidationError):
        ProvenanceEnvelope.model_validate(invalid)

