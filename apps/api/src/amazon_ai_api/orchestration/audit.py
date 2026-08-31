from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import UUID

from amazon_ai_api.db.connection import Database


class AuditWriter(Protocol):
    def write_tool_event(
        self, *, tenant_id: UUID, tool_call_id: UUID, event_type: str, payload: dict[str, Any]
    ) -> None: ...


@dataclass(slots=True)
class MemoryAuditWriter:
    events: list[dict[str, Any]] = field(default_factory=list)

    def write_tool_event(
        self, *, tenant_id: UUID, tool_call_id: UUID, event_type: str, payload: dict[str, Any]
    ) -> None:
        self.events.append(
            {
                "tenant_id": tenant_id,
                "tool_call_id": tool_call_id,
                "event_type": event_type,
                "payload": payload,
            }
        )


class PostgresAuditWriter:
    def __init__(self, database: Database) -> None:
        self._database = database

    def write_tool_event(
        self, *, tenant_id: UUID, tool_call_id: UUID, event_type: str, payload: dict[str, Any]
    ) -> None:
        with self._database.tenant_connection(tenant_id) as connection:
            connection.execute(
                """
                INSERT INTO audit.audit_events (
                  tenant_id, actor_type, event_type, entity_type, entity_id,
                  event_payload, synthetic
                ) VALUES (%s, 'AI', %s, 'TOOL_CALL', %s, %s::jsonb, true)
                """,
                (tenant_id, event_type, str(tool_call_id), json.dumps(payload, default=str)),
            )
            connection.commit()

