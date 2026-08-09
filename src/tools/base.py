"""Tool framework for plop (asd-ste100).

A tool has a name, a description, and an input schema. The agent loop reads
the schema to know how to call the tool. Each tool returns a ToolResult.

The design is plain on purpose. The goal is to show the mechanism, not to
hide it behind a framework.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional


@dataclass
class ToolResult:
    """The result of one tool call.

    Fields:
        ok: True if the tool ran without an error.
        content: The text that goes back to the model. For get_record this is
            a JSON string. The content can be malformed on purpose for the
            malformed-response test cases.
        error: A short error message when ok is False.
        meta: Extra data for the trace and for scoring. It does not go to the
            model.
    """

    ok: bool
    content: str = ""
    error: Optional[str] = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolContext:
    """State that a tool may need at call time.

    Fields:
        write_sink: A list that write_note appends to. The harness reads it to
            check for unwanted writes.
        task_mode: "read_only" or "read_write". A defense can use this to block
            writes on a read-only task. The scaffold does not enforce it yet.
    """

    write_sink: list[dict[str, Any]] = field(default_factory=list)
    task_mode: str = "read_write"


@dataclass
class Tool:
    """One callable tool.

    Fields:
        name: The tool name that the model calls.
        description: A short description for the model.
        input_schema: A JSON Schema object for the tool input.
        func: The function that runs the tool. It takes (args, context) and
            returns a ToolResult.
    """

    name: str
    description: str
    input_schema: dict[str, Any]
    func: Callable[[dict[str, Any], ToolContext], ToolResult]

    def run(self, args: dict[str, Any], context: ToolContext) -> ToolResult:
        """Run the tool with the given args and context."""
        return self.func(args, context)

    def spec(self) -> dict[str, Any]:
        """Return the tool spec in Anthropic tool-use format."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }
