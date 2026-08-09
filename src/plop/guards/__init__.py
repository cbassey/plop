"""plop.guards — a framework-agnostic guard library for tool-use agents.

Import this package into any Python agent. It has no dependency on plop's
demo agent, tools, or harness. The parts:

    GuardPolicy      - plain data: what this run may do, and which patterns,
                       validators, and secrets apply.
    GuardedPipeline  - per-run state plus three hooks: before_tool,
                       after_tool, final_output.
    Pure functions   - each single guard, usable on its own.

Minimal use:

    from plop.guards import GuardPolicy, GuardedPipeline

    policy = GuardPolicy(
        allowed_tools=["search", "fetch"],
        write_tools=["send_email"],
        task_mode="read_only",
        secrets=[SYSTEM_PROMPT],
    )
    pipeline = GuardedPipeline(policy)
"""

from __future__ import annotations

from .checks import (
    check_tool_allowed,
    iteration_cap,
    json_object_validator,
    redact_output,
    sanitize_tool_output,
    strip_injection,
    validate_tool_input,
)
from .patterns import DANGEROUS_INPUT, INJECTION_LINE, TOOL_OUTPUT_ERROR
from .pipeline import REPEAT_CALL_REASON, GuardedPipeline
from .policy import GuardOutcome, GuardPolicy, OutputValidator

__all__ = [
    "GuardPolicy",
    "GuardOutcome",
    "GuardedPipeline",
    "OutputValidator",
    "check_tool_allowed",
    "validate_tool_input",
    "sanitize_tool_output",
    "redact_output",
    "strip_injection",
    "iteration_cap",
    "json_object_validator",
    "DANGEROUS_INPUT",
    "INJECTION_LINE",
    "TOOL_OUTPUT_ERROR",
    "REPEAT_CALL_REASON",
]
