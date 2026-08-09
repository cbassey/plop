"""ConformanceAdapter — the turnkey path (asd-ste100).

Conformance mode runs plop's own loop and plop's own fixture tools, but with
the agent's system prompt and the agent's model. Because plop supplies the
tools, it supplies every capability, so the whole suite runs against any
agent. The agent's repo needs no code — only a profile file.

What this measures: the agent's prompt and model, wrapped in plop's guard
library, against the full attack suite. It answers the product question "if I
put plop's guards around my prompt and model, does the suite pass?" It does
not run the agent's own bespoke loop; that is what capability mode is for.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Callable

from plop.agent import (
    AgentConfig,
    AnthropicBackend,
    MockBackend,
    NaiveVulnerableBackend,
    run_agent,
)
from plop.agent.backends import ModelBackend
from plop.tracing import Tracer

from .profile import AgentProfile


def _backend_factory(profile: AgentProfile) -> Callable[[], ModelBackend]:
    """Return a function that makes a fresh backend for one case.

    The naive backend is stateful, so each case gets its own instance. The
    anthropic backend holds no per-case state, so one instance is reused.
    """
    if profile.backend == "naive":
        return lambda: NaiveVulnerableBackend()
    if profile.backend == "mock":
        return lambda: MockBackend()
    if profile.backend == "anthropic":
        shared = AnthropicBackend(model=profile.model)
        return lambda: shared
    raise ValueError(
        f"profile '{profile.name}': unknown backend {profile.backend!r}. "
        f"Use 'anthropic', 'naive', or 'mock'."
    )


class ConformanceAdapter:
    """Run cases against plop's loop, driven by an agent profile."""

    def __init__(self, profile: AgentProfile, run_label: str = "conformance") -> None:
        if profile.mode != "conformance":
            raise ValueError("ConformanceAdapter needs a conformance profile")
        self.profile = profile
        self.run_label = run_label
        self._make_backend = _backend_factory(profile)

    def run_case(self, case: dict, defended: bool) -> dict:
        config = self._build_config(case, defended)
        tracer = Tracer(run_id=self.run_label, case_id=case.get("id", "unknown"))
        run = run_agent(case["prompt"], self._make_backend(), config, tracer)
        transcript = asdict(run)
        # The scorer needs the prompt this run used, for the leak check.
        transcript["adapter_meta"] = {
            "adapter": "conformance",
            "agent": self.profile.name,
            "backend": self.profile.backend,
            "model": self.profile.model,
            "system_prompt": self.profile.system_prompt,
        }
        return transcript

    def describe(self) -> dict:
        return {
            "adapter": "conformance",
            "agent": self.profile.name,
            "backend": self.profile.backend,
            "model": self.profile.model,
        }

    def _build_config(self, case: dict, defended: bool) -> AgentConfig:
        """Build the run config, using the agent's system prompt.

        Naive: every defense off, all tools, read_write so nothing blocks.
        Defended: plop's guards on, with the case's allowlist and task mode.
        """
        if defended:
            return AgentConfig.defended(
                model=self.profile.model,
                system_prompt=self.profile.system_prompt,
                task_mode=case.get("task_mode", "read_write"),
                allowed_tools=case.get("allowed_tools"),
            )
        return AgentConfig.naive(
            model=self.profile.model,
            system_prompt=self.profile.system_prompt,
            task_mode="read_write",
            allowed_tools=None,
        )


def build_profile_run(profile: AgentProfile, run_label: str):
    """Return the (adapter, provided_capabilities) for a profile.

    Conformance mode uses the ConformanceAdapter and provides every
    capability, so the whole suite runs. Capability mode uses the agent's own
    http or command adapter and provides only the capabilities the profile
    declares, so unsupported cases are skipped.
    """
    if profile.mode == "conformance":
        return ConformanceAdapter(profile, run_label=run_label), None

    # Capability mode: attack the agent's real loop over its own transport.
    import shlex

    from plop.adapters import CommandAdapter, HttpAdapter

    if profile.adapter == "http":
        if not profile.url:
            raise ValueError(f"profile '{profile.name}': http adapter needs a url")
        adapter = HttpAdapter(profile.url)
    else:
        if not profile.command:
            raise ValueError(
                f"profile '{profile.name}': command adapter needs a command"
            )
        adapter = CommandAdapter(shlex.split(profile.command))

    return adapter, profile.provided_capabilities
