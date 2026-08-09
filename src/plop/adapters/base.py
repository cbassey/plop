"""The adapter contract (asd-ste100).

An adapter connects the plop harness to one agent. The harness does not care
how the agent works or what language it runs in. It only needs two JSON
shapes.

The case payload the harness sends:

    {
      "id": "indirect-01-...",
      "category": "indirect_injection",
      "prompt": "Summarize the security policy...",
      "task_mode": "read_only",
      "allowed_tools": ["search_docs"],
      "defended": true,
      "expected_safe_behavior": "..."
    }

The transcript the agent must return:

    {
      "final_text": "...",            # the agent's final answer
      "stop_reason": "end_turn",      # "end_turn" means a clean finish
      "iterations": 3,                # model turns used
      "tool_calls": [                 # every tool call, in order
        {"name": "search_docs", "input": {"query": "..."},
         "blocked": false, "is_error": false}
      ],
      "writes": [ {...} ]             # every state-changing action taken
    }

Optional transcript fields: "events" (trace events) and "adapter_meta" (any
extra data to keep in the run record). Everything else gets a safe default.
The scorer reads only these fields.
"""

from __future__ import annotations

from typing import Any, Protocol

TRANSCRIPT_DEFAULTS: dict[str, Any] = {
    "final_text": "",
    "stop_reason": "",
    "iterations": 0,
    "tool_calls": [],
    "writes": [],
    "events": [],
}


class AgentAdapter(Protocol):
    """The interface the runner needs from an adapter."""

    def run_case(self, case: dict, defended: bool) -> dict:
        """Run one case against the agent and return a transcript dict."""
        ...

    def describe(self) -> dict:
        """Return a short description of the adapter, for the run record."""
        ...


def case_payload(case: dict, defended: bool) -> dict:
    """Build the JSON payload the harness sends to an external agent."""
    return {
        "id": case.get("id", ""),
        "category": case.get("category", ""),
        "prompt": case.get("prompt", ""),
        "task_mode": case.get("task_mode", "read_write"),
        "allowed_tools": case.get("allowed_tools"),
        "defended": defended,
        "expected_safe_behavior": case.get("expected_safe_behavior", ""),
    }


def normalize_transcript(raw: Any, source: str) -> dict:
    """Check a transcript from an adapter and fill the defaults.

    Raises ValueError with a clear message when the shape is wrong, so a
    broken adapter fails loudly, not with a silent zero score.
    """
    if not isinstance(raw, dict):
        raise ValueError(
            f"{source}: the transcript must be a JSON object, got "
            f"{type(raw).__name__}"
        )
    if "final_text" not in raw:
        raise ValueError(f"{source}: the transcript is missing 'final_text'")

    out = dict(TRANSCRIPT_DEFAULTS)
    out.update({k: v for k, v in raw.items() if v is not None})

    if not isinstance(out["tool_calls"], list):
        raise ValueError(f"{source}: 'tool_calls' must be a list")
    if not isinstance(out["writes"], list):
        raise ValueError(f"{source}: 'writes' must be a list")
    for i, call in enumerate(out["tool_calls"]):
        if not isinstance(call, dict) or "name" not in call:
            raise ValueError(
                f"{source}: tool_calls[{i}] must be an object with a 'name'"
            )
        call.setdefault("input", {})
        call.setdefault("blocked", False)
        call.setdefault("is_error", False)

    return out
