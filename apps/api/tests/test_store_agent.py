from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from amazon_ai_api.models.findings import CausalStatus, FindingEnvelope
from amazon_ai_api.orchestration.agents.store_operations import StoreOperationsAgent
from amazon_ai_api.orchestration.audit import MemoryAuditWriter
from amazon_ai_api.orchestration.tool_gateway import ToolGateway
from amazon_ai_api.registries.defaults import build_default_registries
from amazon_ai_api.services.business_clock import BusinessClock
from conftest import TENANT_A
from fakes import FakeStoreMetricsRepository


def build_agent() -> tuple[StoreOperationsAgent, MemoryAuditWriter]:
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
    return StoreOperationsAgent(gateway), audit


def test_store_agent_runs_four_tools_and_returns_evidence_findings() -> None:
    agent, audit = build_agent()

    result = agent.run(
        tenant_id=TENANT_A,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
        question="Why did orders fall today?",
    )

    assert [item.tool_name for item in result.tool_results] == list(agent.TOOL_SEQUENCE)
    assert len(audit.events) == 4
    assert len(result.findings) == 3
    assert all(item.evidence_refs for item in result.findings)
    assert all(item.synthetic for item in result.findings)
    assert all(item.causal_status is not CausalStatus.CONFIRMED_CAUSAL for item in result.findings)
    assert "-55.00%" in result.summary
    assert "-24.00%" in result.summary


def test_finding_without_evidence_is_rejected() -> None:
    agent, _ = build_agent()
    valid = agent.run(
        tenant_id=TENANT_A,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
    ).findings[0]

    with pytest.raises(ValidationError):
        FindingEnvelope.model_validate({**valid.model_dump(), "evidence_refs": ()})


def test_confirmed_causal_requires_experiment_evidence() -> None:
    agent, _ = build_agent()
    valid = agent.run(
        tenant_id=TENANT_A,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
    ).findings[0]

    with pytest.raises(ValidationError):
        FindingEnvelope.model_validate(
            {
                **valid.model_dump(),
                "finding_id": uuid4(),
                "causal_status": CausalStatus.CONFIRMED_CAUSAL,
            }
        )
