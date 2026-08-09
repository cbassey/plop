"""Tool dispatch for the agent loop (asd-ste100).

The dispatcher takes one tool call, runs the allowlist and write guards, runs
the tool, and returns the result text plus trace data. It keeps the tool logic
and the guard logic in one clear place.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from tools import Tool, ToolContext, WRITE_TOOLS

from .backends import ToolCall
from .config import AgentConfig
from .guards import check_tool_allowed, sanitize_tool_output


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
    trace: dict[str, Any] = None


def dispatch(
    call: ToolCall,
    tools: dict[str, Tool],
    context: ToolContext,
    config: AgentConfig,
) -> DispatchResult:
    """Run one tool call through the guards and the tool."""
    trace: dict[str, Any] = {"tool": call.name, "input": call.input}

    # Guard 1: allowlist and read-only write rule.
    guard = check_tool_allowed(call.name, config, WRITE_TOOLS)
    if not guard.allowed:
        trace["blocked_reason"] = guard.reason
        return DispatchResult(
            content=f"Blocked: {guard.reason}",
            is_error=True,
            blocked=True,
            trace=trace,
        )

    # Guard 2: the tool must exist in the registry for this run.
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

    # Guard 3: sanitize tool output before the model reads it (stub for now).
    clean = sanitize_tool_output(result.content, config)
    return DispatchResult(content=clean.value, is_error=False, trace=trace)
