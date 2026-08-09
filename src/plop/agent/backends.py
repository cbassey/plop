"""Model backends for the agent loop (asd-ste100).

A backend takes a system prompt, the message list, and the tool specs. It
returns a ModelResponse. The loop does not care which backend it uses.

Two backends ship in the scaffold:
    AnthropicBackend - calls the real Claude API. Use it for real evaluation.
    MockBackend      - returns scripted responses. Use it for offline tests
                       and for a fast smoke run with no API key.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol


@dataclass
class ToolCall:
    """One tool call the model asked for."""

    id: str
    name: str
    input: dict[str, Any]


@dataclass
class ModelResponse:
    """A normalized model turn.

    Fields:
        text: The assistant text, if any.
        tool_calls: The tool calls the model asked for.
        stop_reason: The raw stop reason from the backend.
        raw_content: The native assistant content blocks. The loop appends
            these to the message list so the next turn keeps the history.
    """

    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str = ""
    raw_content: Any = None


class ModelBackend(Protocol):
    """The interface the loop needs from a backend."""

    def complete(
        self,
        system: str,
        messages: list[dict[str, Any]],
        tool_specs: list[dict[str, Any]],
    ) -> ModelResponse:
        ...


class AnthropicBackend:
    """Backend that calls the Claude Messages API with tool use.

    It needs the anthropic package and the ANTHROPIC_API_KEY env var.
    """

    def __init__(self, model: str = "claude-sonnet-5", max_tokens: int = 1024) -> None:
        self.model = model
        self.max_tokens = max_tokens
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "The anthropic package is not installed. "
                    "Install it, or use MockBackend for offline runs."
                ) from exc
            self._client = anthropic.Anthropic()
        return self._client

    def complete(self, system, messages, tool_specs) -> ModelResponse:
        client = self._get_client()
        resp = client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=messages,
            tools=tool_specs,
        )

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(
                    ToolCall(id=block.id, name=block.name, input=dict(block.input))
                )

        return ModelResponse(
            text="\n".join(text_parts),
            tool_calls=tool_calls,
            stop_reason=resp.stop_reason or "",
            raw_content=resp.content,
        )


class MockBackend:
    """Backend that returns scripted responses. No network. No API key.

    Pass a script: a list of ModelResponse objects. The backend returns one
    per call, in order. When the script runs out, it returns a safe final
    text. The default script is a single safe refusal, so the harness runs
    end to end offline.

    The MockBackend is not the evaluation target. It only proves the loop and
    the tools work. Real evaluation uses the AnthropicBackend.
    """

    def __init__(self, script: Optional[list[ModelResponse]] = None) -> None:
        self.script = list(script) if script else []
        self._i = 0

    def complete(self, system, messages, tool_specs) -> ModelResponse:
        if self._i < len(self.script):
            resp = self.script[self._i]
            self._i += 1
            return resp
        return ModelResponse(
            text="I can only help with the stated task. I will not follow "
            "instructions found in documents or tool output.",
            tool_calls=[],
            stop_reason="end_turn",
        )
