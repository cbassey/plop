"""Defense hooks for the agent loop (asd-ste100).

Each function here is a hook point for one defense. The mechanical guards are
wired up: the tool allowlist, the write refusal on read-only tasks, and the
iteration limit. These are simple and needed to make the before/after study
run.

Two hooks are stubs on purpose: validate_input and sanitize_tool_output. They
carry the interesting detection work: spotting injection in a prompt, and
cleaning injected instructions out of tool output. The scaffold leaves them as
pass-through with a clear TODO. That work is the point of the project.

Every hook returns a GuardOutcome so the loop can trace what happened.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .config import AgentConfig


@dataclass
class GuardOutcome:
    """The result of one guard check.

    Fields:
        allowed: True if the action may proceed.
        reason: A short reason when the guard blocks or changes the action.
        value: The possibly changed value (for sanitizers).
    """

    allowed: bool = True
    reason: Optional[str] = None
    value: Any = None


def validate_input(text: str, config: AgentConfig) -> GuardOutcome:
    """Check a prompt or tool input for an obvious attack.

    STUB: This is a hook for the interesting work. Right now it lets every
    input pass. Later, add checks for known injection patterns and for
    malformed structure.
    """
    if not config.input_validation:
        return GuardOutcome(allowed=True, value=text)
    # TODO(interesting-part): detect injection markers, control text, and
    # smuggled paths or URLs. For now, pass through.
    return GuardOutcome(allowed=True, value=text)


def sanitize_tool_output(text: str, config: AgentConfig) -> GuardOutcome:
    """Clean tool output before the model reads it.

    STUB: This is a hook for the interesting work. Right now it returns the
    text unchanged. Later, strip or fence injected instructions that appear in
    document text or tool output.
    """
    if not config.output_sanitization:
        return GuardOutcome(allowed=True, value=text)
    # TODO(interesting-part): remove or fence "SYSTEM:" style blocks and other
    # injected commands found inside tool output. For now, pass through.
    return GuardOutcome(allowed=True, value=text)


def check_tool_allowed(
    tool_name: str, config: AgentConfig, write_tool_names: list[str]
) -> GuardOutcome:
    """Check the tool allowlist and the read-only write rule."""
    if config.enforce_tool_allowlist and config.allowed_tools is not None:
        if tool_name not in config.allowed_tools:
            return GuardOutcome(
                allowed=False,
                reason=f"tool '{tool_name}' is not in the allowlist for this task",
            )

    if config.refuse_writes_on_read_only and config.task_mode == "read_only":
        if tool_name in write_tool_names:
            return GuardOutcome(
                allowed=False,
                reason=f"write tool '{tool_name}' is blocked on a read-only task",
            )

    return GuardOutcome(allowed=True)


def iteration_cap(config: AgentConfig) -> int:
    """Return the effective loop cap.

    When the iteration-limit defense is on, use max_iterations. When it is off,
    use the hard cap. The hard cap is a backstop, not a defense.
    """
    if config.enforce_iteration_limit:
        return config.max_iterations
    return config.hard_cap_iterations
