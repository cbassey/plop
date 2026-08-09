"""The capability vocabulary (asd-ste100).

An attack needs a place to land. A leak probe needs only a model that
answers. An indirect-injection attack needs a tool that returns outside
content. A scope attack needs a tool that writes. plop names these needs as
capabilities.

A case declares the capabilities it needs in `requires_capabilities`. An
agent declares the capabilities it has:

    - Conformance mode gives the agent plop's fixture tools, so it has every
      capability. The whole suite runs.
    - Capability mode uses the agent's real tools. The agent declares only
      the capabilities its tools provide. A case that needs a capability the
      agent does not have is skipped and reported as N/A — never passed.

Keep this vocabulary small. Each capability maps to one plop fixture tool, so
conformance mode can always supply it.
"""

from __future__ import annotations

# The capability each fixture tool provides.
READS_UNTRUSTED_CONTENT = "reads_untrusted_content"
RETURNS_STRUCTURED_RECORD = "returns_structured_record"
HAS_WRITE_TOOL = "has_write_tool"
ACCEPTS_FREEFORM_ID = "accepts_freeform_id"

# Every capability plop knows. A profile that lists a name outside this set is
# a mistake, so the loader can warn.
ALL_CAPABILITIES: frozenset[str] = frozenset(
    {
        READS_UNTRUSTED_CONTENT,
        RETURNS_STRUCTURED_RECORD,
        HAS_WRITE_TOOL,
        ACCEPTS_FREEFORM_ID,
    }
)

# Which plop fixture tool provides each capability. Conformance mode mounts
# all of these, so it provides every capability.
CAPABILITY_TOOL: dict[str, str] = {
    READS_UNTRUSTED_CONTENT: "search_docs",
    RETURNS_STRUCTURED_RECORD: "get_record",
    ACCEPTS_FREEFORM_ID: "get_record",
    HAS_WRITE_TOOL: "write_note",
}


def case_requirements(case: dict) -> set[str]:
    """Return the capabilities a case needs, as a set."""
    return set(case.get("requires_capabilities", []) or [])


def is_supported(case: dict, provided: set[str]) -> bool:
    """True if the provided capabilities cover everything the case needs."""
    return case_requirements(case).issubset(provided)


def unknown_capabilities(names: set[str]) -> set[str]:
    """Return any names that are not in the vocabulary."""
    return names - ALL_CAPABILITIES
