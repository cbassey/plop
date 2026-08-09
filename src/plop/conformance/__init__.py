"""plop.conformance — turnkey testing for any agent (asd-ste100).

Conformance mode is the out-of-the-box path. Describe an agent in a small
profile file, and plop runs the whole suite against the agent's prompt and
model using plop's own fixture tools and guard library. No code in the
agent's repo.

Capability mode is the opt-in path for testing an agent's real tools. See
plop.adapters and the profile's capability list.
"""

from __future__ import annotations

from .adapter import ConformanceAdapter, build_profile_run
from .capabilities import (
    ALL_CAPABILITIES,
    case_requirements,
    is_supported,
    unknown_capabilities,
)
from .profile import AgentProfile

__all__ = [
    "AgentProfile",
    "ConformanceAdapter",
    "build_profile_run",
    "ALL_CAPABILITIES",
    "case_requirements",
    "is_supported",
    "unknown_capabilities",
]
