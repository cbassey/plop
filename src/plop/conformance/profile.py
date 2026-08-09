"""AgentProfile — a small file that describes the agent under test (asd-ste100).

A profile is the turnkey way to point plop at an agent. It is plain data, so
it can be a JSON or YAML file with no code:

    {
      "name": "quill",
      "mode": "conformance",
      "system_prompt": "You are Quill, a helpful AI assistant ...",
      "model": "claude-sonnet-5",
      "backend": "anthropic"
    }

Two modes:

    conformance - plop runs its own loop and its own fixture tools, driven by
        the agent's system prompt and model. plop provides every capability,
        so the whole suite runs. This is the default and needs no code in the
        agent's repo — only this file.

    capability - plop attacks the agent's real loop and real tools over an
        adapter (http or command). The agent declares which capabilities its
        tools provide. A case that needs a capability the agent lacks is
        skipped, not passed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

from .capabilities import ALL_CAPABILITIES, unknown_capabilities


@dataclass
class AgentProfile:
    """A description of one agent under test.

    Fields:
        name: A short label for the agent, used in run labels and reports.
        mode: "conformance" or "capability".

        For conformance mode:
        system_prompt: The agent's real system prompt.
        model: The model id, for the anthropic backend.
        backend: "anthropic" for a live run, or "naive"/"mock" offline.

        For capability mode:
        adapter: "http" or "command".
        url: The endpoint, for the http adapter.
        command: The command, for the command adapter.
        capabilities: The capabilities the agent's real tools provide. plop
            skips any case that needs a capability not in this list.
    """

    name: str
    mode: str = "conformance"

    system_prompt: str = ""
    model: str = "claude-sonnet-5"
    backend: str = "anthropic"

    adapter: Optional[str] = None
    url: Optional[str] = None
    command: Optional[str] = None
    capabilities: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.mode not in ("conformance", "capability"):
            raise ValueError(
                f"profile '{self.name}': mode must be 'conformance' or "
                f"'capability', got {self.mode!r}"
            )
        if self.mode == "conformance" and not self.system_prompt.strip():
            raise ValueError(
                f"profile '{self.name}': conformance mode needs a system_prompt"
            )
        if self.mode == "capability":
            if self.adapter not in ("http", "command"):
                raise ValueError(
                    f"profile '{self.name}': capability mode needs adapter "
                    f"'http' or 'command'"
                )
            bad = unknown_capabilities(set(self.capabilities))
            if bad:
                raise ValueError(
                    f"profile '{self.name}': unknown capabilities {sorted(bad)}. "
                    f"Known: {sorted(ALL_CAPABILITIES)}"
                )

    @property
    def provided_capabilities(self) -> set[str]:
        """The capabilities available for this run.

        Conformance mode gives the agent plop's fixture tools, so it has every
        capability. Capability mode has only what the profile declares.
        """
        if self.mode == "conformance":
            return set(ALL_CAPABILITIES)
        return set(self.capabilities)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentProfile":
        known = {f: data[f] for f in cls.__dataclass_fields__ if f in data}
        return cls(**known)

    @classmethod
    def load(cls, path: str | Path) -> "AgentProfile":
        """Load a profile from a JSON or YAML file."""
        text = Path(path).read_text(encoding="utf-8")
        # yaml.safe_load reads JSON too, so one loader covers both.
        data = yaml.safe_load(text)
        if not isinstance(data, dict):
            raise ValueError(f"{path}: a profile must be a JSON or YAML object")
        return cls.from_dict(data)
