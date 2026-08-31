from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest

from amazon_ai_api.orchestration.openai_runtime import (
    OpenAICompositionError,
    OpenAIHomeComposer,
)
from amazon_ai_api.registries.defaults import build_default_registries
from conftest import TENANT_A
from test_supervisor import build_supervisor


class FakeResponses:
    def __init__(self, outputs: list[object]) -> None:
        self.outputs = outputs
        self.calls = 0

    def parse(self, **_: object) -> SimpleNamespace:
        value = self.outputs[self.calls]
        self.calls += 1
        if isinstance(value, Exception):
            raise value
        return SimpleNamespace(output_parsed=value)


class FakeClient:
    def __init__(self, outputs: list[object]) -> None:
        self.responses = FakeResponses(outputs)


@pytest.mark.asyncio
async def test_structured_composer_retries_once_and_accepts_safe_composition() -> None:
    supervisor, _ = build_supervisor()
    run = await supervisor.daily_home_run(
        tenant_id=TENANT_A,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
    )
    client = FakeClient([RuntimeError("temporary"), run.composition])
    composer = OpenAIHomeComposer(
        api_key="test-key",
        model="test-model",
        component_registry=build_default_registries().components,
        client=client,
    )

    result = composer.compose(
        candidate=run.composition,
        findings=run.agent_result.findings,
    )

    assert result.data_status.ai_mode == "ENABLED"
    assert client.responses.calls == 2
    assert [block.block_id for block in result.blocks] == [
        block.block_id for block in run.composition.blocks
    ]


@pytest.mark.asyncio
async def test_structured_composer_rejects_new_block_ids() -> None:
    supervisor, _ = build_supervisor()
    run = await supervisor.daily_home_run(
        tenant_id=TENANT_A,
        marketplace="ATVPDKIKX0DER",
        business_date=date(2026, 8, 31),
    )
    unsafe_block = run.composition.blocks[0].model_copy(update={"block_id": uuid4()})
    unsafe = run.composition.model_copy(
        update={"blocks": (unsafe_block, *run.composition.blocks[1:])}
    )
    client = FakeClient([unsafe, unsafe])
    composer = OpenAIHomeComposer(
        api_key="test-key",
        model="test-model",
        component_registry=build_default_registries().components,
        client=client,
    )

    with pytest.raises(OpenAICompositionError):
        composer.compose(candidate=run.composition, findings=run.agent_result.findings)

    assert client.responses.calls == 2
