from __future__ import annotations

from datetime import date
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from amazon_ai_api.models.home import HomeComposition, JudgmentReason
from amazon_ai_api.orchestration.agents.store_operations import (
    StoreAgentResult,
    StoreOperationsAgent,
)
from amazon_ai_api.services.home_composition import HomeCompositionService


class TriggerType(StrEnum):
    DAILY_HOME = "DAILY_HOME"
    USER_QUESTION = "USER_QUESTION"


class DailyHomeRun(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trigger: TriggerType
    agent_result: StoreAgentResult
    composition: HomeComposition


class JarvisSupervisor:
    """M1 control plane for the first store-operations vertical slice."""

    def __init__(
        self,
        *,
        store_agent: StoreOperationsAgent,
        deterministic_composer: HomeCompositionService,
    ) -> None:
        self._store_agent = store_agent
        self._deterministic_composer = deterministic_composer

    async def daily_home_run(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> DailyHomeRun:
        agent_result = self._store_agent.run(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        candidate = await self._deterministic_composer.get_composition(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        composition = candidate.model_copy(
            update={
                "overall_judgment": agent_result.summary,
                "judgment_reasons": tuple(
                    JudgmentReason(claim=item.claim, evidence_refs=item.evidence_refs)
                    for item in agent_result.findings[:2]
                ),
            }
        )
        return DailyHomeRun(
            trigger=TriggerType.DAILY_HOME,
            agent_result=agent_result,
            composition=HomeComposition.model_validate(composition.model_dump()),
        )

    async def daily_home(
        self, *, tenant_id: UUID, marketplace: str, business_date: date
    ) -> HomeComposition:
        run = await self.daily_home_run(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date,
        )
        return run.composition
