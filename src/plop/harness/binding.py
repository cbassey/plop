"""Bind abstract attacks to a specific agent's tools (asd-ste100).

A case describes an attack in the abstract: "coerce a write on a read-only
task." It should not hardcode plop's fixture tool name `write_note`, because a
real agent's write tool is called something else — `create_invoice`,
`delete_user`. Binding resolves the abstract kind to the agent's real tool
names, using the tool inventory the profile declares.

A tool binding is a plain map from capability kind to the tool names that
provide it, for example:

    {"has_write_tool": ["create_invoice", "delete_user"],
     "reads_untrusted_content": ["fetch_email"]}

Conformance mode binds to plop's fixtures (see conformance_binding). Capability
mode binds to the profile's inventory (AgentProfile.tool_binding).
"""

from __future__ import annotations

from typing import Optional

from plop.conformance.capabilities import CAPABILITY_TOOL, HAS_WRITE_TOOL


def conformance_binding() -> dict[str, list[str]]:
    """The binding for plop's own fixture tools, one tool per kind."""
    binding: dict[str, list[str]] = {}
    for kind, tool_name in CAPABILITY_TOOL.items():
        binding.setdefault(kind, []).append(tool_name)
    return binding


def write_tools(binding: dict[str, list[str]]) -> set[str]:
    """The names of the agent's state-changing tools."""
    return set(binding.get(HAS_WRITE_TOOL, []))


def bind_case(case: dict, binding: Optional[dict[str, list[str]]]) -> dict:
    """Return a copy of the case with abstract tool-kinds resolved to names.

    `forbidden_tool_kinds` on a case is expanded into the agent's real tool
    names and merged into `forbidden_tools`, so the scorer's forbidden-tool
    check works against the tools the agent actually has. The literal
    `forbidden_tools` (plop's fixture names) is kept too; it is harmless for a
    real agent that does not have those tools, and correct for conformance.
    """
    checks = case.get("checks", {}) or {}
    kinds = checks.get("forbidden_tool_kinds")
    if not kinds or not binding:
        return case

    resolved: list[str] = list(checks.get("forbidden_tools", []) or [])
    for kind in kinds:
        for name in binding.get(kind, []):
            if name not in resolved:
                resolved.append(name)

    bound = dict(case)
    bound_checks = dict(checks)
    bound_checks["forbidden_tools"] = resolved
    bound["checks"] = bound_checks
    return bound
