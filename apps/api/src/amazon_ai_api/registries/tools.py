from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.registries.base import (
    DuplicateRegistrationError,
    UnknownRegistrationError,
    UnsafeRegistrationError,
)


class ToolAccessMode(StrEnum):
    READ_ONLY = "READ_ONLY"
    INTERNAL_DRAFT_WRITE = "INTERNAL_DRAFT_WRITE"


class ToolDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(pattern=r"^[a-z][a-z0-9_]{2,79}$")
    description: str = Field(min_length=1, max_length=500)
    access_mode: ToolAccessMode
    capabilities: tuple[str, ...] = Field(min_length=1)
    allowed_agents: tuple[str, ...] = Field(min_length=1)
    required_permission: str = Field(min_length=1, max_length=120)
    external_mutation: bool = False
    input_schema_version: str = "1.0"
    output_schema_version: str = "1.0"


class ToolRegistry:
    _forbidden_external_tool_names = frozenset(
        {
            "execute_" + "approved_action",
            "update_amazon_ad",
            "update_amazon_listing",
            "update_amazon_price",
        }
    )

    def __init__(self) -> None:
        self._definitions: dict[str, ToolDefinition] = {}

    def register(self, definition: ToolDefinition) -> None:
        if definition.name in self._definitions:
            raise DuplicateRegistrationError(f"tool already registered: {definition.name}")
        if definition.external_mutation or definition.name in self._forbidden_external_tool_names:
            raise UnsafeRegistrationError(
                f"external mutation tool is forbidden in MVP: {definition.name}"
            )
        self._definitions[definition.name] = definition

    def get(self, name: str) -> ToolDefinition:
        try:
            return self._definitions[name]
        except KeyError as exc:
            raise UnknownRegistrationError(f"unknown tool: {name}") from exc

    def resolve_for_agent(
        self,
        *,
        agent_id: str,
        requested_capabilities: set[str],
        granted_permissions: set[str],
    ) -> tuple[ToolDefinition, ...]:
        return tuple(
            definition
            for definition in sorted(self._definitions.values(), key=lambda item: item.name)
            if agent_id in definition.allowed_agents
            and requested_capabilities.intersection(definition.capabilities)
            and definition.required_permission in granted_permissions
        )

    def assert_mvp_safe(self) -> None:
        unsafe = [
            item.name
            for item in self._definitions.values()
            if item.external_mutation or item.name in self._forbidden_external_tool_names
        ]
        if unsafe:
            raise UnsafeRegistrationError(f"unsafe MVP tools registered: {unsafe}")

    def list_public(self) -> tuple[ToolDefinition, ...]:
        return tuple(sorted(self._definitions.values(), key=lambda item: item.name))

    def __len__(self) -> int:
        return len(self._definitions)

