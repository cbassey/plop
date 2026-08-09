"""The built-in adapter (asd-ste100).

This adapter runs plop's own demo agent: the hand-rolled loop, the three test
tools, and the guard pipeline. It is the reference implementation of the
transcript contract, and the default for the before/after study.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Callable, Optional

from plop.agent import AgentConfig, NaiveVulnerableBackend, run_agent
from plop.agent.backends import ModelBackend
from plop.tracing import Tracer

# A backend factory makes a fresh backend for each case. The naive backend is
# stateful, so each case must get its own instance.
BackendFactory = Callable[[], ModelBackend]


def build_config(case: dict, defended: bool, model: str) -> AgentConfig:
    """Build the agent config for one case.

    For a naive run, every defense is off and all tools are available. For a
    defended run, the defenses are on and the tool allowlist and task mode
    come from the case.
    """
    task_mode = case.get("task_mode", "read_write")
    allowed = case.get("allowed_tools")
    if defended:
        return AgentConfig.defended(
            model=model, task_mode=task_mode, allowed_tools=allowed
        )
    # Naive: defenses off, no allowlist, and read_write mode so nothing blocks.
    return AgentConfig.naive(model=model, task_mode="read_write", allowed_tools=None)


class BuiltinAdapter:
    """Run cases against plop's own demo agent."""

    def __init__(
        self,
        backend: Optional[ModelBackend] = None,
        backend_factory: Optional[BackendFactory] = None,
        model: str = "claude-sonnet-5",
        run_label: str = "run",
    ) -> None:
        if backend_factory is None:
            if backend is not None:
                backend_factory = lambda: backend  # noqa: E731
            else:
                backend_factory = lambda: NaiveVulnerableBackend()  # noqa: E731
        self.backend_factory = backend_factory
        self.model = model
        self.run_label = run_label

    def run_case(self, case: dict, defended: bool) -> dict:
        config = build_config(case, defended, self.model)
        tracer = Tracer(run_id=self.run_label, case_id=case.get("id", "unknown"))
        run = run_agent(case["prompt"], self.backend_factory(), config, tracer)
        transcript = asdict(run)
        transcript["adapter_meta"] = _config_summary(config)
        return transcript

    def describe(self) -> dict:
        return {"adapter": "builtin", "model": self.model}


def _config_summary(config: AgentConfig) -> dict:
    return {
        "model": config.model,
        "task_mode": config.task_mode,
        "allowed_tools": config.allowed_tools,
        "input_validation": config.input_validation,
        "output_sanitization": config.output_sanitization,
        "enforce_iteration_limit": config.enforce_iteration_limit,
        "enforce_tool_allowlist": config.enforce_tool_allowlist,
        "refuse_writes_on_read_only": config.refuse_writes_on_read_only,
        "max_iterations": config.max_iterations,
    }
