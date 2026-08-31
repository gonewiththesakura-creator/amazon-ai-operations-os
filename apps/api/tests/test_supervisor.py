from datetime import date, datetime, timezone

import pytest

from amazon_ai_api.adapters.synthetic import SyntheticAdapter
from amazon_ai_api.orchestration.agents.store_operations import StoreOperationsAgent
from amazon_ai_api.orchestration.audit import MemoryAuditWriter
from amazon_ai_api.orchestration.supervisor import JarvisSupervisor, TriggerType
from amazon_ai_api.orchestration.tool_gateway import ToolGateway
from amazon_ai_api.registries.defaults import build_default_registries
from amazon_ai_api.services.business_clock import BusinessClock
from amazon_ai_api.services.home_composition import HomeCompositionService
from conftest import TENANT_A
from fakes import FakeStoreMetricsRepository


def build_supervisor() -> tuple[JarvisSupervisor, MemoryAuditWriter]:
    repository = FakeStoreMetricsRepository()
    clock = BusinessClock(
        "America/Los_Angeles",
        logical_now=datetime(2026, 8, 31, 12, tzinfo=timezone.utc),
    )
    registries = build_default_registries()
    audit = MemoryAuditWriter()
    gateway = ToolGateway(
        registry=registries.tools,
        repository=repository,
        business_clock=clock,
        audit_writer=audit,
    )
    composer = HomeCompositionService(
        adapter=SyntheticAdapter(repository=repository, business_clock=clock),
        component_registry=registries.components,
        ai_mode="DETERMINISTIC_FALLBACK",
    )
    return JarvisSupervisor(
        store_agent=StoreOperationsAgent(gateway),
        deterministic_composer=composer,
    ), audit


@pytest.mark.asyncio
async def test_supervisor_runs_agent_before_validated_home_composition() -> None:
    supervisor, audit = build_supervisor()

    run = await supervisor.daily_home_run(
        tenant_id=TENANT_A,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
    )

    assert run.trigger is TriggerType.DAILY_HOME
    assert len(run.agent_result.tool_results) == 4
    assert len(audit.events) == 4
    assert run.composition.home_state == "ORDER_AD_ANOMALY"
    assert run.composition.overall_judgment == run.agent_result.summary
    assert run.composition.data_status.ai_mode == "DETERMINISTIC_FALLBACK"
    assert all(reason.evidence_refs for reason in run.composition.judgment_reasons)
