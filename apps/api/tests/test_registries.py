import pytest

from amazon_ai_api.models.home import HomeBlock
from amazon_ai_api.registries.base import RegistryError, UnsafeRegistrationError
from amazon_ai_api.registries.defaults import ADS, STORE, build_default_registries
from amazon_ai_api.registries.tools import ToolAccessMode, ToolDefinition, ToolRegistry


def test_default_registries_are_complete_and_cross_validated() -> None:
    bundle = build_default_registries()

    bundle.validate()
    assert len(bundle.components) == 20
    assert len(bundle.agents) == 12
    assert len(bundle.tools) == 22
    assert {item.access_mode for item in bundle.tools.list_public()} == {
        ToolAccessMode.READ_ONLY,
        ToolAccessMode.INTERNAL_DRAFT_WRITE,
    }
    assert all(not item.external_mutation for item in bundle.tools.list_public())


def test_tool_resolution_exposes_only_agent_capability_and_permission_match() -> None:
    tools = build_default_registries().tools

    resolved = tools.resolve_for_agent(
        agent_id=ADS,
        requested_capabilities={"ads"},
        granted_permissions={"analytics:read"},
    )
    assert [tool.name for tool in resolved] == ["get_ad_performance"]

    no_permission = tools.resolve_for_agent(
        agent_id=ADS,
        requested_capabilities={"approval_draft"},
        granted_permissions={"analytics:read"},
    )
    assert no_permission == ()


def test_external_write_tools_are_rejected_at_registration() -> None:
    registry = ToolRegistry()
    forbidden_name = "execute_" + "approved_action"
    forbidden = ToolDefinition(
        name=forbidden_name,
        description="Unsafe test fixture.",
        access_mode=ToolAccessMode.READ_ONLY,
        capabilities=("execution",),
        allowed_agents=(STORE,),
        required_permission="analytics:read",
    )
    external_mutation = ToolDefinition(
        name="mutate_external_system",
        description="Unsafe test fixture.",
        access_mode=ToolAccessMode.INTERNAL_DRAFT_WRITE,
        capabilities=("execution",),
        allowed_agents=(STORE,),
        required_permission="recommendation:draft",
        external_mutation=True,
    )

    with pytest.raises(UnsafeRegistrationError):
        registry.register(forbidden)
    with pytest.raises(UnsafeRegistrationError):
        registry.register(external_mutation)


def test_component_registry_rejects_payload_not_matching_registered_schema(
    client, tenant_headers
) -> None:
    bundle = build_default_registries()
    response = client.get("/v1/home/composition", headers=tenant_headers)
    raw_block = response.json()["blocks"][0]
    raw_block["payload"].pop("summary")
    block = HomeBlock.model_validate(raw_block)

    with pytest.raises(RegistryError, match="invalid payload"):
        bundle.components.validate_block(block)


def test_openapi_and_registry_expose_no_external_execution_capability(
    client, tenant_headers
) -> None:
    openapi = client.get("/openapi.json").json()
    tools = client.get("/v1/registries/tools", headers=tenant_headers).json()
    forbidden_name = "execute_" + "approved_action"

    assert forbidden_name not in str(openapi)
    assert forbidden_name not in {tool["name"] for tool in tools}
    assert all(tool["external_mutation"] is False for tool in tools)
    assert {tool["access_mode"] for tool in tools} <= {
        "READ_ONLY",
        "INTERNAL_DRAFT_WRITE",
    }
