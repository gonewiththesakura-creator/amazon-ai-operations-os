from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError

from amazon_ai_api.models.home import ComponentType, HomeBlock
from amazon_ai_api.registries.base import (
    DuplicateRegistrationError,
    RegistryError,
    UnknownRegistrationError,
)


@dataclass(frozen=True, slots=True)
class ComponentDefinition:
    component_type: ComponentType
    version: str
    payload_model: type[BaseModel]

    @property
    def key(self) -> tuple[ComponentType, str]:
        return (self.component_type, self.version)

    def public_descriptor(self) -> dict[str, Any]:
        return {
            "component_type": self.component_type.value,
            "version": self.version,
            "payload_schema": self.payload_model.model_json_schema(),
        }


class ComponentRegistry:
    def __init__(self) -> None:
        self._definitions: dict[tuple[ComponentType, str], ComponentDefinition] = {}

    def register(self, definition: ComponentDefinition) -> None:
        if definition.key in self._definitions:
            raise DuplicateRegistrationError(f"component already registered: {definition.key}")
        self._definitions[definition.key] = definition

    def get(self, component_type: ComponentType, version: str) -> ComponentDefinition:
        try:
            return self._definitions[(component_type, version)]
        except KeyError as exc:
            raise UnknownRegistrationError(
                f"unknown component: {component_type.value}@{version}"
            ) from exc

    def validate_block(self, block: HomeBlock) -> None:
        definition = self.get(block.component_type, block.component_version)
        try:
            definition.payload_model.model_validate(block.payload)
        except ValidationError as exc:
            raise RegistryError(
                f"invalid payload for {block.component_type.value}@{block.component_version}"
            ) from exc

    def list_public(self) -> list[dict[str, Any]]:
        return [
            definition.public_descriptor()
            for definition in sorted(
                self._definitions.values(),
                key=lambda item: (item.component_type.value, item.version),
            )
        ]

    def __len__(self) -> int:
        return len(self._definitions)

