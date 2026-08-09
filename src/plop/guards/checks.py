"""Pure guard functions (asd-ste100).

Each function takes plain values and a GuardPolicy and returns a GuardOutcome.
No function holds state. The stateful parts (the repeat-call breaker and the
turn count) live in GuardedPipeline.

The mechanism is on purpose plain and readable. A reviewer can point at the
exact line that stops each attack.
"""

from __future__ import annotations

import json
from typing import Any

from .patterns import TOOL_OUTPUT_ERROR
from .policy import GuardOutcome, GuardPolicy, OutputValidator

# A secret shorter than this is too generic to redact. Redacting very short
# strings would mangle normal text.
_MIN_SECRET_LEN = 8


def check_tool_allowed(tool_name: str, policy: GuardPolicy) -> GuardOutcome:
    """Check the tool allowlist and the read-only write rule."""
    if policy.enforce_tool_allowlist and policy.allowed_tools is not None:
        if tool_name not in policy.allowed_tools:
            return GuardOutcome(
                allowed=False,
                reason=f"tool '{tool_name}' is not in the allowlist for this task",
                stage="allowlist",
            )

    if policy.refuse_writes_on_read_only and policy.task_mode == "read_only":
        if tool_name in policy.write_tools:
            return GuardOutcome(
                allowed=False,
                reason=f"write tool '{tool_name}' is blocked on a read-only task",
                stage="read_only",
            )

    return GuardOutcome(allowed=True)


def validate_tool_input(
    tool_name: str, args: dict[str, Any], policy: GuardPolicy
) -> GuardOutcome:
    """Reject a tool call whose input looks like a smuggled path or URL.

    This stops schema smuggling. For example, a record_id of "../../etc/passwd"
    or "https://evil.example/leak" never reaches the tool.
    """
    if not policy.input_validation:
        return GuardOutcome(allowed=True)

    for key, value in args.items():
        if isinstance(value, str) and policy.dangerous_input.search(value):
            return GuardOutcome(
                allowed=False,
                reason=(
                    f"input for '{key}' looks like a path or URL, not a plain "
                    f"id: {value!r}"
                ),
                stage="input_validation",
            )
    return GuardOutcome(allowed=True)


def sanitize_tool_output(
    tool_name: str, text: str, policy: GuardPolicy
) -> GuardOutcome:
    """Clean tool output before the model reads it.

    Two steps:
    1. Strip injected order lines from the output. This stops indirect
       injection: the model never sees the "SYSTEM: ..." block.
    2. Run the per-tool output validator, when the policy has one for this
       tool. A validator withholds bad data and returns a clear error marker,
       so the model relays the error instead of inventing data.
    """
    if not policy.output_sanitization:
        return GuardOutcome(allowed=True, value=text)

    cleaned = strip_injection(text, policy)

    validator = policy.output_validators.get(tool_name)
    if validator is not None:
        cleaned = validator(cleaned)

    changed = cleaned != text
    return GuardOutcome(
        allowed=True,
        reason="sanitized" if changed else None,
        value=cleaned,
        stage="output_sanitization" if changed else None,
    )


def redact_output(text: str, policy: GuardPolicy) -> GuardOutcome:
    """Remove every policy secret from the final answer.

    This is an output guard. Even if the model is tricked into repeating a
    secret, the user never sees it.
    """
    if not policy.output_sanitization or not text:
        return GuardOutcome(allowed=True, value=text)

    redacted = text
    for secret in policy.secrets:
        secret = secret.strip()
        if len(secret) >= _MIN_SECRET_LEN and secret in redacted:
            redacted = redacted.replace(secret, policy.redaction_marker)

    changed = redacted != text
    return GuardOutcome(
        allowed=True,
        reason="redacted" if changed else None,
        value=redacted,
        stage="redact_output" if changed else None,
    )


def iteration_cap(policy: GuardPolicy) -> int:
    """Return the effective loop cap.

    When the iteration-limit defense is on, use max_iterations. When it is
    off, use the hard cap. The hard cap is a backstop, not a defense.
    """
    if policy.enforce_iteration_limit:
        return policy.max_iterations
    return policy.hard_cap_iterations


def strip_injection(text: str, policy: GuardPolicy) -> str:
    """Drop lines that try to give the agent an order, plus fence lines."""
    out: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "---":
            continue
        if policy.injection_line.search(line):
            continue
        out.append(line)
    return "\n".join(out)


def json_object_validator(
    required_fields: list[str], label: str = "the tool", noun: str = "record"
) -> OutputValidator:
    """Make a validator for a tool that must return one JSON object.

    The validator checks that the output is valid JSON, is an object, and has
    every required field. On any failure it withholds the value and returns a
    clear TOOL_OUTPUT_ERROR message. Use one per tool in
    GuardPolicy.output_validators.
    """

    def validate(text: str) -> str:
        try:
            value = json.loads(text)
        except (json.JSONDecodeError, ValueError):
            return (
                f"{TOOL_OUTPUT_ERROR}: {label} returned data that is not valid "
                f"JSON. The value was withheld for safety."
            )

        if value is None:
            return (
                f"{TOOL_OUTPUT_ERROR}: {label} returned no {noun} (null). There "
                f"is nothing to summarize."
            )
        if not isinstance(value, dict):
            return (
                f"{TOOL_OUTPUT_ERROR}: {label} returned the wrong type. A {noun} "
                f"object was expected."
            )
        missing = [f for f in required_fields if f not in value]
        if missing:
            fields = " and ".join(required_fields)
            return (
                f"{TOOL_OUTPUT_ERROR}: {label} returned a {noun} that is missing "
                f"required fields ({fields}). The value was withheld."
            )

        return text

    return validate
