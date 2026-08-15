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
            skips any case that needs a capability not in this list. This is
            the coarse way to declare an agent. Prefer `tools`.
        tools: The agent's real tool inventory, each entry a dict with a
            "name" and a list of "kinds" (capabilities). This binds abstract
            attacks to the agent's own tools: a "coerce a write" case then
            forbids the agent's real write tools by name, not plop's fixture
            name. When `tools` is set, capabilities are derived from it.

        For any mode:
        canaries: Secret strings a leak must never echo — for example a marker
            planted in the agent's system prompt. Lets the prompt-leak check
            stay verifiable for an agent that will not return its own prompt.
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
    tools: list[dict[str, Any]] = field(default_factory=list)
    canaries: list[str] = field(default_factory=list)

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
        self._validate_tools()
        if self.mode == "capability":
            if self.adapter not in ("http", "command"):
                raise ValueError(
                    f"profile '{self.name}': capability mode needs adapter "
                    f"'http' or 'command'"
                )
            bad = unknown_capabilities(self._declared_capabilities())
            if bad:
                raise ValueError(
                    f"profile '{self.name}': unknown capabilities {sorted(bad)}. "
                    f"Known: {sorted(ALL_CAPABILITIES)}"
                )

    def _validate_tools(self) -> None:
        """Check the tool inventory shape and its kinds."""
        for i, tool in enumerate(self.tools):
            if not isinstance(tool, dict) or "name" not in tool:
                raise ValueError(
                    f"profile '{self.name}': tools[{i}] must be an object with "
                    f"a 'name' and a 'kinds' list"
                )
            kinds = set(tool.get("kinds", []) or [])
            bad = unknown_capabilities(kinds)
            if bad:
                raise ValueError(
                    f"profile '{self.name}': tool {tool['name']!r} lists unknown "
                    f"kinds {sorted(bad)}. Known: {sorted(ALL_CAPABILITIES)}"
                )

    def _declared_capabilities(self) -> set[str]:
        """Capabilities from the tool inventory, or the flat list as a fallback."""
        if self.tools:
            caps: set[str] = set()
            for tool in self.tools:
                caps.update(tool.get("kinds", []) or [])
            return caps
        return set(self.capabilities)

    def tool_binding(self) -> dict[str, list[str]]:
        """Map each capability kind to the agent's real tool names.

        This is how an abstract case ("forbid any write tool") is bound to the
        agent under test ("forbid create_invoice and delete_user"). Empty when
        the profile declares no tool inventory.
        """
        binding: dict[str, list[str]] = {}
        for tool in self.tools:
            for kind in tool.get("kinds", []) or []:
                binding.setdefault(kind, []).append(tool["name"])
        return binding

    @property
    def provided_capabilities(self) -> set[str]:
        """The capabilities available for this run.

        Conformance mode gives the agent plop's fixture tools, so it has every
        capability. Capability mode has only what the profile declares.
        """
        if self.mode == "conformance":
            return set(ALL_CAPABILITIES)
        return self._declared_capabilities()

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
