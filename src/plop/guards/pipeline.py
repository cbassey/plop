"""GuardedPipeline — the three hooks a host agent calls (asd-ste100).

The pipeline holds the per-run state: the set of tool calls seen (for the
repeat-call breaker). A host agent loop wraps its own tool execution with
three calls:

    pipeline = GuardedPipeline(policy)

    for turn in range(pipeline.iteration_cap):
        ... ask the model ...
        for call in model_tool_calls:
            gate = pipeline.before_tool(call.name, call.input)
            if not gate.allowed:
                ... return f"Blocked: {gate.reason}" as the tool result ...
                continue
            raw = run_your_tool(call.name, call.input)
            clean = pipeline.after_tool(call.name, raw)
            ... return clean.value as the tool result ...

    final = pipeline.final_output(final_text).value

That is the whole contract. The pipeline does not import any framework, any
model client, or any tool code. Make one pipeline per run: the repeat-call
state must not leak between runs.
"""

from __future__ import annotations

import json
from typing import Any

from .checks import (
    check_tool_allowed,
    iteration_cap,
    redact_output,
    sanitize_tool_output,
    validate_tool_input,
)
from .policy import GuardOutcome, GuardPolicy

# The message the breaker returns. It tells the model to stop, in plain words.
REPEAT_CALL_REASON = "repeated identical call. Stop and give a final answer."


class GuardedPipeline:
    """Per-run guard state plus the before/after/final hooks."""

    def __init__(self, policy: GuardPolicy) -> None:
        self.policy = policy
        self._seen_calls: set[str] = set()

    @property
    def iteration_cap(self) -> int:
        """The loop turn cap for this run."""
        return iteration_cap(self.policy)

    def before_tool(self, tool_name: str, args: dict[str, Any]) -> GuardOutcome:
        """Run every input-side guard for one tool call.

        Order:
            1. Repeat-call breaker (only when the iteration limit is on).
            2. Tool allowlist and the read-only write rule.
            3. Tool-input validation (smuggled paths and URLs).
        """
        sig = tool_name + "|" + json.dumps(args, sort_keys=True, default=str)
        if self.policy.enforce_iteration_limit and sig in self._seen_calls:
            return GuardOutcome(
                allowed=False, reason=REPEAT_CALL_REASON, stage="loop_break"
            )
        self._seen_calls.add(sig)

        gate = check_tool_allowed(tool_name, self.policy)
        if not gate.allowed:
            return gate

        return validate_tool_input(tool_name, args, self.policy)

    def after_tool(self, tool_name: str, output: str) -> GuardOutcome:
        """Clean and validate one tool output before the model reads it."""
        return sanitize_tool_output(tool_name, output, self.policy)

    def final_output(self, text: str) -> GuardOutcome:
        """Redact secrets from the final answer."""
        return redact_output(text, self.policy)
