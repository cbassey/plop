"""Tool registry for plop (asd-ste100).

This package holds the three test tools and a small registry. The agent loop
reads the registry to get the tool specs and to dispatch calls.
"""

from __future__ import annotations

from .base import Tool, ToolContext, ToolResult
from .get_record import TOOL as GET_RECORD
from .search_docs import TOOL as SEARCH_DOCS
from .write_note import TOOL as WRITE_NOTE

ALL_TOOLS: list[Tool] = [SEARCH_DOCS, GET_RECORD, WRITE_NOTE]

READ_ONLY_TOOLS: list[str] = [SEARCH_DOCS.name, GET_RECORD.name]
WRITE_TOOLS: list[str] = [WRITE_NOTE.name]


def registry(names: list[str] | None = None) -> dict[str, Tool]:
    """Return a name to Tool map.

    If names is given, return only those tools. This supports tool
    allowlisting per task.
    """
    all_map = {t.name: t for t in ALL_TOOLS}
    if names is None:
        return dict(all_map)
    return {name: all_map[name] for name in names if name in all_map}


def specs(names: list[str] | None = None) -> list[dict]:
    """Return the tool specs in Anthropic tool-use format."""
    return [t.spec() for t in registry(names).values()]


__all__ = [
    "Tool",
    "ToolContext",
    "ToolResult",
    "ALL_TOOLS",
    "READ_ONLY_TOOLS",
    "WRITE_TOOLS",
    "registry",
    "specs",
]
