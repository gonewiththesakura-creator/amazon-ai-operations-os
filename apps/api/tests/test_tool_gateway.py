from datetime import datetime, timezone

import pytest

from amazon_ai_api.models.tools import ToolStatus
from amazon_ai_api.orchestration.audit import MemoryAuditWriter
from amazon_ai_api.orchestration.tool_gateway import (
    ToolAuthorizationError,
    ToolGateway,
    ToolInputError,
)
from amazon_ai_api.registries.defaults import build_default_registries
from amazon_ai_api.services.business_clock import BusinessClock
from conftest import TENANT_A
from fakes import FakeStoreMetricsRepository


def build_gateway() -> tuple[ToolGateway, MemoryAuditWriter]:
    audit = MemoryAuditWriter()
    gateway = ToolGateway(
        registry=build_default_registries().tools,
        repository=FakeStoreMetricsRepository(),
        business_clock=BusinessClock(
            "America/Los_Angeles",
            logical_now=datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
        ),
        audit_writer=audit,
    )
    return gateway, audit


def arguments() -> dict[str, object]:
    return {
        "tenant_id": str(TENANT_A),
        "marketplace": "ATVPDKIKX0DER",
        "business_date": "2026-08-31",
    }


@pytest.mark.parametrize(
    "tool_name",
    ("get_store_summary", "get_order_funnel", "compare_periods", "detect_anomalies"),
)
def test_store_tools_return_evidence_backed_results(tool_name: str) -> None:
    gateway, audit = build_gateway()

    result = gateway.execute(
        agent_id="store_operations", tool_name=tool_name, arguments=arguments()
    )

    assert result.status is ToolStatus.SUCCEEDED
    assert result.synthetic is True
    assert result.evidence_refs
    assert result.data_period is not None
    assert result.source == tuple(sorted(result.source))
    assert result.updated_at.tzinfo is not None
    assert audit.events[-1]["event_type"] == "TOOL_SUCCEEDED"


def test_gateway_rejects_unauthorized_agent_and_audits_attempt() -> None:
    gateway, audit = build_gateway()

    with pytest.raises(ToolAuthorizationError):
        gateway.execute(
            agent_id="ads_search_terms",
            tool_name="get_store_summary",
            arguments=arguments(),
        )

    assert audit.events[-1]["event_type"] == "TOOL_DENIED"


def test_gateway_rejects_invalid_input() -> None:
    gateway, audit = build_gateway()
    values = arguments()
    values["business_date"] = "not-a-date"

    with pytest.raises(ToolInputError):
        gateway.execute(
            agent_id="store_operations", tool_name="get_store_summary", arguments=values
        )

    assert audit.events[-1]["event_type"] == "TOOL_INPUT_REJECTED"


def test_registered_tool_is_explicitly_not_implemented() -> None:
    gateway, audit = build_gateway()

    result = gateway.execute(
        agent_id="store_operations",
        tool_name="get_asin_performance",
        arguments=arguments(),
    )

    assert result.status is ToolStatus.NOT_IMPLEMENTED
    assert result.output == {}
    assert result.evidence_refs == ()
    assert audit.events[-1]["event_type"] == "TOOL_NOT_IMPLEMENTED"


def test_store_summary_is_deterministic() -> None:
    gateway, _ = build_gateway()

    result = gateway.execute(
        agent_id="store_operations",
        tool_name="compare_periods",
        arguments=arguments(),
    )

    assert result.data_period is not None
    assert result.data_period.start.date().isoformat() == "2026-08-31"
    assert result.output["orders_delta_pct"] == -55.0
    assert result.output["sessions_delta_pct"] == -24.0
