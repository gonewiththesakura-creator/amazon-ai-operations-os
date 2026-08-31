from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from amazon_ai_api.registries.base import DuplicateRegistrationError, UnknownRegistrationError


class AgentDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    agent_id: str = Field(pattern=r"^[a-z][a-z0-9_]{2,79}$")
    display_name: str = Field(min_length=1, max_length=120)
    responsibility: str = Field(min_length=1, max_length=500)
    tool_names: tuple[str, ...] = Field(min_length=1)
    output_schema: str = Field(min_length=1, max_length=120)
    prompt_version: str = Field(min_length=1, max_length=32)
    max_tool_calls: int = Field(ge=1, le=30)


class AgentRegistry:
    def __init__(self) -> None:
        self._definitions: dict[str, AgentDefinition] = {}

    def register(self, definition: AgentDefinition) -> None:
        if definition.agent_id in self._definitions:
            raise DuplicateRegistrationError(
                f"agent already registered: {definition.agent_id}"
            )
        self._definitions[definition.agent_id] = definition

    def get(self, agent_id: str) -> AgentDefinition:
        try:
            return self._definitions[agent_id]
        except KeyError as exc:
            raise UnknownRegistrationError(f"unknown agent: {agent_id}") from exc

    def list_public(self) -> tuple[AgentDefinition, ...]:
        return tuple(sorted(self._definitions.values(), key=lambda item: item.agent_id))

    def __len__(self) -> int:
        return len(self._definitions)
