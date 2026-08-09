"""Adversarial runner for plop (asd-ste100).

The runner:
    1. Loads the adversarial suite from prompts/adversarial.yaml.
    2. Runs each case against the agent.
    3. Scores each case.
    4. Writes a per-run JSON file with full traces.
    5. Writes a summary report with the defense rate overall and per category.

The runner supports many runs. Give each run a label, for example "naive" or
"defended". The summary files then support a before and after comparison.
"""

from __future__ import annotations

import dataclasses
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

from agent import AgentConfig, MockBackend, run_agent
from agent.backends import ModelBackend
from tracing import Tracer

from .scoring import CaseScore, score_case

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SUITE = _REPO_ROOT / "prompts" / "adversarial.yaml"
_DEFAULT_RESULTS = _REPO_ROOT / "results"


def load_suite(path: str | Path = _DEFAULT_SUITE) -> list[dict]:
    """Load the adversarial cases from the YAML suite."""
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return data.get("cases", [])


def build_config(case: dict, defended: bool, model: str) -> AgentConfig:
    """Build the agent config for one case.

    For a naive run, every defense is off and all tools are available. For a
    defended run, the defenses are on and the tool allowlist and task mode come
    from the case.
    """
    task_mode = case.get("task_mode", "read_write")
    allowed = case.get("allowed_tools")
    if defended:
        return AgentConfig.defended(
            model=model, task_mode=task_mode, allowed_tools=allowed
        )
    # Naive: defenses off, no allowlist, and read_write mode so nothing blocks.
    return AgentConfig.naive(model=model, task_mode="read_write", allowed_tools=None)


def run_case(
    case: dict,
    backend: ModelBackend,
    config: AgentConfig,
    run_label: str,
) -> dict[str, Any]:
    """Run one case and return a record with the run and the score."""
    tracer = Tracer(run_id=run_label, case_id=case["id"])
    run = run_agent(case["prompt"], backend, config, tracer)
    score = score_case(case, run)
    return {
        "case_id": case["id"],
        "category": case["category"],
        "prompt": case["prompt"],
        "expected_safe_behavior": case.get("expected_safe_behavior", ""),
        "config": _config_summary(config),
        "run": asdict(run),
        "score": _score_to_dict(score),
    }


def run_suite(
    run_label: str,
    defended: bool,
    backend: Optional[ModelBackend] = None,
    model: str = "claude-sonnet-5",
    suite_path: str | Path = _DEFAULT_SUITE,
    results_dir: str | Path = _DEFAULT_RESULTS,
) -> dict[str, Any]:
    """Run the whole suite once and write the results.

    Args:
        run_label: A short label for the run, for example "naive".
        defended: True to turn the defenses on.
        backend: The model backend. Defaults to MockBackend for an offline run.
        model: The model id for a real backend.
        suite_path: The path to the adversarial YAML.
        results_dir: The folder for the output files.

    Returns:
        The summary dict.
    """
    if backend is None:
        backend = MockBackend()

    cases = load_suite(suite_path)
    records: list[dict[str, Any]] = []
    for case in cases:
        config = build_config(case, defended, model)
        records.append(run_case(case, backend, config, run_label))

    summary = _summarize(run_label, defended, records)

    results_path = Path(results_dir)
    results_path.mkdir(parents=True, exist_ok=True)
    (results_path / f"run-{run_label}.json").write_text(
        json.dumps({"summary": summary, "records": records}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (results_path / f"summary-{run_label}.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return summary


def _summarize(run_label: str, defended: bool, records: list[dict]) -> dict[str, Any]:
    """Build the summary with the defense rate overall and per category."""
    total = len(records)
    passed = sum(1 for r in records if r["score"]["passed"])

    by_cat: dict[str, dict[str, int]] = {}
    for r in records:
        cat = r["category"]
        bucket = by_cat.setdefault(cat, {"total": 0, "passed": 0})
        bucket["total"] += 1
        if r["score"]["passed"]:
            bucket["passed"] += 1

    per_category = {
        cat: {
            "total": b["total"],
            "passed": b["passed"],
            "defense_rate": round(b["passed"] / b["total"], 3) if b["total"] else 0.0,
        }
        for cat, b in sorted(by_cat.items())
    }

    failed_cases = [
        {
            "case_id": r["case_id"],
            "category": r["category"],
            "failed_checks": [
                c["name"] for c in r["score"]["checks"] if not c["passed"]
            ],
        }
        for r in records
        if not r["score"]["passed"]
    ]

    return {
        "run_label": run_label,
        "defended": defended,
        "total": total,
        "passed": passed,
        "defense_rate": round(passed / total, 3) if total else 0.0,
        "per_category": per_category,
        "failed_cases": failed_cases,
    }


def _config_summary(config: AgentConfig) -> dict[str, Any]:
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


def _score_to_dict(score: CaseScore) -> dict[str, Any]:
    return {
        "case_id": score.case_id,
        "category": score.category,
        "passed": score.passed,
        "checks": [dataclasses.asdict(c) for c in score.checks],
    }
