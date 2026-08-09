"""Tool dispatch for the agent loop (asd-ste100).

The dispatcher takes one tool call and runs it through the guard pipeline and
the tool:

    1. pipeline.before_tool - repeat-call breaker, allowlist, read-only rule,
                              and input validation.
    2. run the tool.
    3. pipeline.after_tool  - sanitize and validate the result.

The guards themselves live in plop.guards. That package is a library with no
dependency on this demo agent, so any other agent can use the same pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from plop.guards import GuardedPipeline
from plop.tools import Tool, ToolContext

from .backends import ToolCall


@dataclass
class DispatchResult:
    """The outcome of one dispatched tool call.

    Fields:
        content: The text to send back to the model as the tool result.
        is_error: True if the call failed or was blocked.
        blocked: True if a guard blocked the call.
        trace: Extra data for the trace.
    """

    content: str
    is_error: bool = False
    blocked: bool = False
    trace: dict[str, Any] = field(default_factory=dict)


def dispatch(
    call: ToolCall,
    tools: dict[str, Tool],
    context: ToolContext,
    pipeline: GuardedPipeline,
) -> DispatchResult:
    """Run one tool call through the guard pipeline and the tool."""
    trace: dict[str, Any] = {"tool": call.name, "input": call.input}

    # Input-side guards: breaker, allowlist, read-only rule, input validation.
    gate = pipeline.before_tool(call.name, call.input)
    if not gate.allowed:
        trace["blocked_reason"] = gate.reason
        if gate.stage == "loop_break":
            trace["loop_break"] = True
        return DispatchResult(
            content=f"Blocked: {gate.reason}",
            is_error=True,
            blocked=True,
            trace=trace,
        )

    # The tool must exist in the registry for this run.
    tool = tools.get(call.name)
    if tool is None:
        trace["blocked_reason"] = "unknown tool"
        return DispatchResult(
            content=f"Blocked: unknown tool '{call.name}'",
            is_error=True,
            blocked=True,
            trace=trace,
        )

    # Run the tool.
    result = tool.run(call.input, context)
    trace["ok"] = result.ok
    trace["meta"] = result.meta

    if not result.ok:
        return DispatchResult(
            content=f"Error: {result.error}",
            is_error=True,
            trace=trace,
        )

    # Output-side guard: sanitize and validate before the model reads it.
    clean = pipeline.after_tool(call.name, result.content)
    if clean.value != result.content:
        trace["sanitized"] = True
    return DispatchResult(content=clean.value, is_error=False, trace=trace)
