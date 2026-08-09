"""Adversarial runner for plop (asd-ste100).

The runner:
    1. Loads the adversarial suite from prompts/adversarial.yaml.
    2. Runs each case through an adapter. The adapter connects the harness to
       the agent under test — the built-in demo agent, or any external agent
       over HTTP or a command (see plop.adapters).
    3. Scores each transcript.
    4. Writes a per-run JSON file with full traces.
    5. Writes a summary report with the defense rate overall and per category.

The runner supports many runs. Give each run a label, for example "naive" or
"defended". The summary files then support a before and after comparison.
"""

from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any, Optional

import yaml

from plop.adapters import AgentAdapter, BuiltinAdapter
from plop.adapters.builtin import BackendFactory, build_config
from plop.agent.backends import ModelBackend

from .scoring import CaseScore, score_case

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_SUITE = _REPO_ROOT / "prompts" / "adversarial.yaml"
_DEFAULT_RESULTS = _REPO_ROOT / "results"


def load_suite(path: str | Path = _DEFAULT_SUITE) -> list[dict]:
    """Load the adversarial cases from the YAML suite."""
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return data.get("cases", [])


def run_case(
    case: dict,
    adapter: AgentAdapter,
    defended: bool,
) -> dict[str, Any]:
    """Run one case through the adapter and return a record with the score."""
    transcript = adapter.run_case(case, defended)
    score = score_case(case, transcript)
    return {
        "case_id": case["id"],
        "category": case["category"],
        "prompt": case["prompt"],
        "expected_safe_behavior": case.get("expected_safe_behavior", ""),
        "config": transcript.pop("adapter_meta", None) or adapter.describe(),
        "run": transcript,
        "score": _score_to_dict(score),
    }


def run_suite(
    run_label: str,
    defended: bool,
    adapter: Optional[AgentAdapter] = None,
    backend: Optional[ModelBackend] = None,
    backend_factory: Optional[BackendFactory] = None,
    model: str = "claude-sonnet-5",
    suite_path: str | Path = _DEFAULT_SUITE,
    results_dir: str | Path = _DEFAULT_RESULTS,
) -> dict[str, Any]:
    """Run the whole suite once and write the results.

    Args:
        run_label: A short label for the run, for example "naive".
        defended: True to ask for a defended run. The builtin adapter turns
            its guards on. An external adapter receives the flag in the case
            payload and applies its own defenses.
        adapter: The adapter for the agent under test. When None, the runner
            uses the BuiltinAdapter with the backend arguments below.
        backend: A single backend instance for the builtin adapter. Use this
            for a stateless backend.
        backend_factory: A function that makes a fresh backend per case, for
            a stateful backend like the naive agent. This wins over backend.
        model: The model id for a real backend in the builtin adapter.
        suite_path: The path to the adversarial YAML.
        results_dir: The folder for the output files.

    Returns:
        The summary dict.
    """
    if adapter is None:
        adapter = BuiltinAdapter(
            backend=backend,
            backend_factory=backend_factory,
            model=model,
            run_label=run_label,
        )

    cases = load_suite(suite_path)
    records: list[dict[str, Any]] = []
    for case in cases:
        records.append(run_case(case, adapter, defended))

    summary = _summarize(run_label, defended, records)
    summary["adapter"] = adapter.describe()

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


def _score_to_dict(score: CaseScore) -> dict[str, Any]:
    return {
        "case_id": score.case_id,
        "category": score.category,
        "passed": score.passed,
        "checks": [dataclasses.asdict(c) for c in score.checks],
    }


__all__ = ["load_suite", "build_config", "run_case", "run_suite"]
