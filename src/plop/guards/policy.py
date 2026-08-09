"""GuardPolicy and GuardOutcome (asd-ste100).

A GuardPolicy describes what one agent run may do. It is plain data. It does
not know about any agent framework, any model backend, or any tool
implementation. The host agent declares its own facts:

    - which tools exist for the task (allowed_tools),
    - which tools write (write_tools),
    - whether the task may write at all (task_mode),
    - which strings must never leak (secrets),
    - how to validate each tool's output (output_validators).

Every defense flag defaults to on. Use GuardPolicy.all_off() for a study of
an undefended agent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .patterns import DANGEROUS_INPUT, INJECTION_LINE

# A validator takes the raw tool output text and returns the text to give to
# the model. It returns an error marker string when the output is bad.
OutputValidator = Callable[[str], str]


@dataclass
class GuardOutcome:
    """The result of one guard check.

    Fields:
        allowed: True if the action may proceed.
        reason: A short reason when the guard blocks or changes the action.
        value: The possibly changed value, for the sanitizer and the redactor.
        stage: The name of the guard that decided, for traces.
    """

    allowed: bool = True
    reason: Optional[str] = None
    value: Any = None
    stage: Optional[str] = None


@dataclass
class GuardPolicy:
    """The guard settings for one agent run.

    Scope fields:
        allowed_tools: The tool names the agent may call. None means all.
        write_tools: The tool names that change state. The read-only rule
            uses this list.
        task_mode: "read_only" or "read_write".
        max_iterations: The loop turn cap when the limit defense is on.
        hard_cap_iterations: A backstop cap when the limit defense is off.
            This is not a defense. It only stops a truly endless run.

    Defense flags (all on by default):
        enforce_tool_allowlist: Block calls to tools not in allowed_tools.
        refuse_writes_on_read_only: Block write tools on a read-only task.
        enforce_iteration_limit: Use max_iterations, and break on a repeated
            identical tool call.
        input_validation: Reject tool input that looks like a smuggled path
            or URL.
        output_sanitization: Strip injected order lines from tool output,
            run the per-tool output validators, and redact secrets from the
            final answer.

    Extension points:
        dangerous_input: The pattern for smuggled tool input.
        injection_line: The pattern for injected order lines in tool output.
        output_validators: A map of tool name to output validator.
        secrets: Strings that must never appear in the final answer, for
            example the system prompt.
        redaction_marker: The text that replaces a leaked secret.
    """

    allowed_tools: Optional[list[str]] = None
    write_tools: list[str] = field(default_factory=list)
    task_mode: str = "read_write"
    max_iterations: int = 6
    hard_cap_iterations: int = 20

    enforce_tool_allowlist: bool = True
    refuse_writes_on_read_only: bool = True
    enforce_iteration_limit: bool = True
    input_validation: bool = True
    output_sanitization: bool = True

    dangerous_input: re.Pattern = DANGEROUS_INPUT
    injection_line: re.Pattern = INJECTION_LINE
    output_validators: dict[str, OutputValidator] = field(default_factory=dict)
    secrets: list[str] = field(default_factory=list)
    redaction_marker: str = "[redacted]"

    @classmethod
    def all_on(cls, **overrides) -> "GuardPolicy":
        """Return a policy with every defense on. This is the default."""
        return cls(**overrides)

    @classmethod
    def all_off(cls, **overrides) -> "GuardPolicy":
        """Return a policy with every defense off, for a naive study run."""
        base = dict(
            enforce_tool_allowlist=False,
            refuse_writes_on_read_only=False,
            enforce_iteration_limit=False,
            input_validation=False,
            output_sanitization=False,
        )
        base.update(overrides)
        return cls(**base)
