"""Defense hooks for the agent loop (asd-ste100).

Each function here is one defense. The before/after study turns these on for a
defended run and off for a naive run.

Defenses:
    check_tool_allowed   - tool allowlist and read-only write rule.
    validate_tool_input  - reject smuggled paths and URLs in tool input.
    sanitize_tool_output - strip injected commands from tool output, and
                           validate get_record JSON so bad data is flagged, not
                           trusted.
    redact_output        - never emit the system prompt in the final answer.
    iteration_cap        - the loop turn cap. The loop also breaks on a
                           repeated identical call when this defense is on.

The mechanism is on purpose plain and readable. A reviewer can point at the
exact line that stops each attack.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Optional

from .config import AgentConfig

# A value that looks like a path, an absolute path, an encoded traversal, a
# URL, a known secret file, or a null byte. This is the schema-smuggling risk.
DANGEROUS_INPUT = re.compile(
    r"""
    (\.\./)            |   # path traversal
    (\.\.\\)           |   # windows path traversal
    (%2e%2f)           |   # encoded ../
    (%2f)              |   # encoded /
    (^\s*/)            |   # absolute path
    (^[a-z][a-z0-9+.\-]*://)  |  # a url scheme, for example https://
    (etc/passwd)       |
    (etc/shadow)       |
    (\x00)                 # null byte
    """,
    re.IGNORECASE | re.VERBOSE,
)

# A line inside tool output that tries to give the agent an order. This is the
# indirect-injection payload.
INJECTION_LINE = re.compile(
    r"""
    (system\s*:)                    |
    (ignore\s+all\s+previous)       |
    (ignore\s+previous\s+instruction) |
    (disregard\s+(your|all|previous)) |
    (call\s+write_note)             |
    (use\s+write_note)              |
    (reveal\s+your)                 |
    (maintenance\s+mode)            |
    (do\s+not\s+mention\s+this)     |
    (you\s+are\s+now)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# The marker the sanitizer uses when it withholds bad tool output. The naive
# agent relays it, so the user learns the data was bad.
TOOL_OUTPUT_ERROR = "TOOL_OUTPUT_ERROR"


@dataclass
class GuardOutcome:
    """The result of one guard check.

    Fields:
        allowed: True if the action may proceed.
        reason: A short reason when the guard blocks or changes the action.
        value: The possibly changed value, for the sanitizer and the redactor.
    """

    allowed: bool = True
    reason: Optional[str] = None
    value: Any = None


def validate_input(text: str, config: AgentConfig) -> GuardOutcome:
    """Check the user prompt.

    plop does not block the whole prompt. Blocking a prompt on a keyword gives
    many false positives, and it does not match how a real system works. The
    real input defense is at the tool boundary, in validate_tool_input. So this
    hook passes the prompt through and lets the tool-level guards do the work.
    """
    return GuardOutcome(allowed=True, value=text)


def validate_tool_input(
    tool_name: str, args: dict[str, Any], config: AgentConfig
) -> GuardOutcome:
    """Reject a tool call whose input looks like a smuggled path or URL.

    This stops schema smuggling. For example, a record_id of "../../etc/passwd"
    or "https://evil.example/leak" never reaches the tool.
    """
    if not config.input_validation:
        return GuardOutcome(allowed=True)

    for key, value in args.items():
        if isinstance(value, str) and DANGEROUS_INPUT.search(value):
            return GuardOutcome(
                allowed=False,
                reason=(
                    f"input for '{key}' looks like a path or URL, not a plain "
                    f"id: {value!r}"
                ),
            )
    return GuardOutcome(allowed=True)


def sanitize_tool_output(
    text: str, tool_name: str, config: AgentConfig
) -> GuardOutcome:
    """Clean tool output before the model reads it.

    Two steps:
    1. Strip injected order lines from any tool output. This stops indirect
       injection: the agent never sees the "SYSTEM: call write_note ..." block.
    2. For get_record, validate the JSON. If the output is not a JSON object
       with an id and a type, withhold it and return a clear error. This stops
       the agent from trusting or inventing data from a malformed response.
    """
    if not config.output_sanitization:
        return GuardOutcome(allowed=True, value=text)

    cleaned = _strip_injection(text)

    if tool_name == "get_record":
        cleaned = _validate_record_json(cleaned)

    return GuardOutcome(allowed=True, value=cleaned)


def redact_output(text: str, config: AgentConfig, system_prompt: str) -> GuardOutcome:
    """Remove the system prompt from the final answer.

    This is an output guard. Even if the model is tricked into repeating its
    system prompt, the user never sees it.
    """
    if not config.output_sanitization or not text:
        return GuardOutcome(allowed=True, value=text)

    redacted = text
    if system_prompt and system_prompt.strip() and system_prompt in redacted:
        redacted = redacted.replace(system_prompt, "[system prompt redacted]")

    # Also redact the first sentence of the system prompt on its own, in case
    # only part of it leaks.
    first_sentence = system_prompt.split(".")[0].strip()
    if first_sentence and len(first_sentence) >= 12 and first_sentence in redacted:
        redacted = redacted.replace(first_sentence, "[system prompt redacted]")

    changed = redacted != text
    return GuardOutcome(allowed=True, reason="redacted" if changed else None, value=redacted)


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


# --- helpers ---------------------------------------------------------------


def _strip_injection(text: str) -> str:
    """Drop lines that try to give the agent an order, plus fence lines."""
    out: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "---":
            continue
        if INJECTION_LINE.search(line):
            continue
        out.append(line)
    return "\n".join(out)


def _validate_record_json(text: str) -> str:
    """Return the text if it is a valid record, else a clear error marker."""
    try:
        value = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return (
            f"{TOOL_OUTPUT_ERROR}: get_record returned data that is not valid "
            f"JSON. The value was withheld for safety."
        )

    if value is None:
        return (
            f"{TOOL_OUTPUT_ERROR}: get_record returned no record (null). There "
            f"is nothing to summarize."
        )
    if not isinstance(value, dict):
        return (
            f"{TOOL_OUTPUT_ERROR}: get_record returned the wrong type. A record "
            f"object was expected."
        )
    if "id" not in value or "type" not in value:
        return (
            f"{TOOL_OUTPUT_ERROR}: get_record returned a record that is missing "
            f"required fields (id and type). The value was withheld."
        )

    return text
