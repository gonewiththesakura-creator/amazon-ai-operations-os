from typing import Any

from fastapi import APIRouter, Request

from amazon_ai_api.registries.agents import AgentDefinition
from amazon_ai_api.registries.tools import ToolDefinition
from amazon_ai_api.routes.dependencies import TenantId


router = APIRouter(prefix="/v1/registries", tags=["registries"])


@router.get("/components", response_model=list[dict[str, Any]])
async def list_components(request: Request, tenant_id: TenantId) -> list[dict[str, Any]]:
    del tenant_id
    return request.app.state.registries.components.list_public()


@router.get("/agents", response_model=list[AgentDefinition])
async def list_agents(request: Request, tenant_id: TenantId) -> tuple[AgentDefinition, ...]:
    del tenant_id
    return request.app.state.registries.agents.list_public()


@router.get("/tools", response_model=list[ToolDefinition])
async def list_tools(request: Request, tenant_id: TenantId) -> tuple[ToolDefinition, ...]:
    del tenant_id
    return request.app.state.registries.tools.list_public()

