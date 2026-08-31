from __future__ import annotations

import json
from typing import Any, Protocol

from openai import OpenAI

from amazon_ai_api.models.findings import FindingEnvelope
from amazon_ai_api.models.home import HomeComposition
from amazon_ai_api.registries.components import ComponentRegistry


class OpenAICompositionError(RuntimeError):
    pass


class HomeAIComposer(Protocol):
    def compose(
        self,
        *,
        candidate: HomeComposition,
        findings: tuple[FindingEnvelope, ...],
    ) -> HomeComposition: ...


class OpenAIHomeComposer:
    """Structured-output layer that cannot introduce new facts or components."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        component_registry: ComponentRegistry,
        client: Any | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("OpenAI API key is required when OpenAI is enabled")
        self._client = client or OpenAI(api_key=api_key)
        self._model = model
        self._components = component_registry

    def compose(
        self,
        *,
        candidate: HomeComposition,
        findings: tuple[FindingEnvelope, ...],
    ) -> HomeComposition:
        last_error: Exception | None = None
        for _ in range(2):
            try:
                response = self._client.responses.parse(
                    model=self._model,
                    input=[
                        {
                            "role": "system",
                            "content": (
                                "You are the Jarvis supervisor. Return only the supplied "
                                "HomeComposition schema. Select and order only candidate blocks. "
                                "Do not create numbers, evidence, component types, actions, or "
                                "causal claims. Keep synthetic=true and preserve every factual "
                                "payload and provenance envelope exactly."
                            ),
                        },
                        {
                            "role": "user",
                            "content": json.dumps(
                                {
                                    "candidate": candidate.model_dump(mode="json"),
                                    "findings": [item.model_dump(mode="json") for item in findings],
                                },
                                ensure_ascii=False,
                            ),
                        },
                    ],
                    text_format=HomeComposition,
                    store=False,
                )
                parsed = response.output_parsed
                if parsed is None:
                    raise OpenAICompositionError("OpenAI returned no parsed composition")
                return self._validate_against_candidate(candidate, parsed)
            except Exception as exc:  # SDK and schema failures share one bounded retry policy.
                last_error = exc
        raise OpenAICompositionError("OpenAI composition failed after one retry") from last_error

    def _validate_against_candidate(
        self, candidate: HomeComposition, parsed: HomeComposition
    ) -> HomeComposition:
        immutable_fields = (
            "tenant_id",
            "business_date",
            "marketplace",
            "home_state",
            "objective_profile",
            "synthetic",
            "generated_at",
        )
        if any(getattr(candidate, field) != getattr(parsed, field) for field in immutable_fields):
            raise OpenAICompositionError("OpenAI changed immutable composition context")
        if not parsed.synthetic:
            raise OpenAICompositionError("OpenAI output must remain synthetic")

        candidates = {item.block_id: item for item in candidate.blocks}
        if len(parsed.blocks) != len({item.block_id for item in parsed.blocks}):
            raise OpenAICompositionError("OpenAI returned duplicate blocks")
        ordered_blocks = []
        for priority, proposed in enumerate(parsed.blocks, start=1):
            source = candidates.get(proposed.block_id)
            if source is None:
                raise OpenAICompositionError("OpenAI returned an unregistered candidate block")
            factual_fields = (
                "component_type",
                "component_version",
                "payload",
                "evidence_refs",
                "data_period",
                "updated_at",
                "provenance",
                "synthetic",
            )
            if any(getattr(source, field) != getattr(proposed, field) for field in factual_fields):
                raise OpenAICompositionError("OpenAI changed a protected factual block field")
            safe_block = source.model_copy(
                update={
                    "priority": priority,
                    "title": proposed.title,
                    "display_reason": proposed.display_reason,
                }
            )
            self._components.validate_block(safe_block)
            ordered_blocks.append(safe_block)

        known_evidence = {
            (ref.kind, ref.reference_id)
            for block in candidate.blocks
            for ref in block.evidence_refs
        }
        known_evidence.update(
            (ref.kind, ref.reference_id)
            for reason in candidate.judgment_reasons
            for ref in reason.evidence_refs
        )
        known_evidence.update(
            (ref.kind, ref.reference_id)
            for action in candidate.top_actions
            for ref in action.evidence_refs
        )
        known_evidence.update(
            (ref.kind, ref.reference_id)
            for signal in (candidate.top_issue, candidate.best_signal)
            for ref in signal.evidence_refs
        )
        for reason in parsed.judgment_reasons:
            if any((ref.kind, ref.reference_id) not in known_evidence for ref in reason.evidence_refs):
                raise OpenAICompositionError("OpenAI introduced unknown judgment evidence")
        for signal in (parsed.top_issue, parsed.best_signal):
            if any((ref.kind, ref.reference_id) not in known_evidence for ref in signal.evidence_refs):
                raise OpenAICompositionError("OpenAI introduced unknown signal evidence")
        candidate_actions = {item.action_id for item in candidate.top_actions}
        if any(item.action_id not in candidate_actions for item in parsed.top_actions):
            raise OpenAICompositionError("OpenAI introduced an unknown action")

        result = parsed.model_copy(
            update={
                "composition_id": candidate.composition_id,
                "data_status": candidate.data_status.model_copy(update={"ai_mode": "ENABLED"}),
                "blocks": tuple(ordered_blocks),
                "requires_approval": True,
                "synthetic": True,
            }
        )
        return HomeComposition.model_validate(result.model_dump())
