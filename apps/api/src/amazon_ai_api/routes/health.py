from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict


router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    service: str
    version: str
    mode: str


class ReadinessResponse(HealthResponse):
    components: int
    agents: int
    tools: int
    external_writes_enabled: bool


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="amazon-ai-api",
        version="0.1.0",
        mode="synthetic",
    )


@router.get("/health/ready", response_model=ReadinessResponse)
async def readiness(request: Request) -> ReadinessResponse:
    registries = request.app.state.registries
    registries.validate()
    return ReadinessResponse(
        status="ready",
        service="amazon-ai-api",
        version="0.1.0",
        mode="synthetic",
        components=len(registries.components),
        agents=len(registries.agents),
        tools=len(registries.tools),
        external_writes_enabled=False,
    )

