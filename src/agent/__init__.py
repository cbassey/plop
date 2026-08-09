"""Bare-metal agent loop for plop (asd-ste100)."""

from __future__ import annotations

from .backends import AnthropicBackend, ModelBackend, ModelResponse, MockBackend, ToolCall
from .config import AgentConfig
from .loop import AgentRun, run_agent
from .naive_backend import NaiveVulnerableBackend

__all__ = [
    "AgentConfig",
    "AgentRun",
    "run_agent",
    "ModelBackend",
    "ModelResponse",
    "ToolCall",
    "AnthropicBackend",
    "MockBackend",
    "NaiveVulnerableBackend",
]
