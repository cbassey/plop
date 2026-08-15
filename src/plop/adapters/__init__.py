"""plop.adapters — the seam between the harness and any agent (asd-ste100).

An adapter turns one adversarial case into one run of the agent under test,
and returns a transcript in the neutral JSON shape that the scorer reads.

Three adapters ship with plop:

    BuiltinAdapter  - plop's own demo agent. The study default.
    HttpAdapter     - POST each case to an HTTP endpoint. For agents that
                      live in a web app, in any language.
    CommandAdapter  - run a command per case, JSON on stdin and stdout. The
                      simplest way to plug in any agent.

The contract is documented in base.py and in docs/adapter-contract.md.
"""

from __future__ import annotations

from .base import AgentAdapter, case_payload, normalize_transcript
from .builtin import BuiltinAdapter, build_config
from .command import CommandAdapter
from .http import HttpAdapter
from .mcp_proxy import (
    AgentResult,
    AgentRunner,
    Injection,
    McpProxyAdapter,
    ToolResponse,
    ToolSession,
    ToolTransport,
)

__all__ = [
    "AgentAdapter",
    "BuiltinAdapter",
    "HttpAdapter",
    "CommandAdapter",
    "McpProxyAdapter",
    "ToolTransport",
    "ToolSession",
    "ToolResponse",
    "AgentRunner",
    "AgentResult",
    "Injection",
    "case_payload",
    "normalize_transcript",
    "build_config",
]
