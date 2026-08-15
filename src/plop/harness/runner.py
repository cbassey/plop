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

import json
import sys
from pathlib import Path
from typing import Any, Optional

import yaml

from plop.adapters import AgentAdapter, BuiltinAdapter
from plop.adapters.builtin import BackendFactory, build_config
from plop.agent.backends import ModelBackend
from plop.conformance.capabilities import case_requirements, is_supported

from .binding import bind_case, conformance_binding, write_tools as _write_tools
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
    canaries: Optional[list[str]] = None,
    tool_binding: Optional[dict[str, list[str]]] = None,
) -> dict[str, Any]:
    """Run one case through the adapter and return a record with the score."""
    # Bind the abstract attack to this agent's real tools before scoring.
    bound = bind_case(case, tool_binding)
    transcript = adapter.run_case(bound, defended)
    meta = transcript.get("adapter_meta") or {}
    meta = meta if isinstance(meta, dict) else {}
    system_prompt = meta.get("system_prompt", "")
    # Canaries may come from the adapter's own metadata or from the run. Either
    # lets a leak check stay verifiable for an agent that will not echo its
    # whole prompt.
    case_canaries = list(canaries or []) + list(meta.get("canaries") or [])
    score = score_case(
        bound,
        transcript,
        system_prompt=system_prompt,
        canaries=case_canaries,
        write_tools=_write_tools(tool_binding or {}),
    )
    return {
        "case_id": case["id"],
        "category": case["category"],
        "prompt": case["prompt"],
        "expected_safe_behavior": case.get("expected_safe_behavior", ""),
        "config": transcript.pop("adapter_meta", None) or adapter.describe(),
        "run": transcript,
        "score": _score_to_dict(score),
    }


def _skipped_record(case: dict, missing: set[str]) -> dict[str, Any]:
    """Return a record for a case the agent cannot support.

    A skipped case is N/A: it never counts as passed and it is left out of the
    denominator. This keeps the defense rate honest — an agent does not get
    credit for an attack that could not even be delivered.
    """
    return {
        "case_id": case["id"],
        "category": case["category"],
        "prompt": case["prompt"],
        "expected_safe_behavior": case.get("expected_safe_behavior", ""),
        "config": None,
        "run": None,
        "score": {
            "case_id": case["id"],
            "category": case["category"],
            "status": "skipped",
            "passed": None,
            "skipped": True,
            "skipped_reason": f"agent lacks capabilities: {sorted(missing)}",
            "checks": [],
        },
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
    provided_capabilities: Optional[set[str]] = None,
    canaries: Optional[list[str]] = None,
    tool_binding: Optional[dict[str, list[str]]] = None,
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
        provided_capabilities: The capabilities the agent has. A case that
            needs a capability outside this set is skipped and reported as
            N/A. None means the agent has every capability, so nothing is
            skipped (the builtin and conformance default).
        canaries: Secret strings (for example a marker planted in the agent's
            system prompt) that a leak must not echo. Lets leak checks stay
            verifiable for an agent that will not return its own prompt.
        tool_binding: A map from capability kind to the agent's real tool
            names, used to bind abstract attacks to this agent's tools. When
            None, plop uses its own fixture binding for the builtin and
            conformance paths (provided_capabilities is None) and no binding
            for a capability-mode agent that declared no tool inventory.

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

    if tool_binding is None and provided_capabilities is None:
        # The builtin and conformance paths run plop's own fixture tools.
        tool_binding = conformance_binding()

    cases = load_suite(suite_path)
    records: list[dict[str, Any]] = []
    total = len(cases)
    for index, case in enumerate(cases, start=1):
        case_id = case.get("id", f"case-{index}")
        print(
            f"[{index}/{total}] {case_id} …",
            file=sys.stderr,
            flush=True,
        )
        if provided_capabilities is not None and not is_supported(
            case, provided_capabilities
        ):
            missing = case_requirements(case) - provided_capabilities
            record = _skipped_record(case, missing)
            records.append(record)
            print(
                f"[{index}/{total}] {case_id} skip",
                file=sys.stderr,
                flush=True,
            )
            continue

        record = run_case(
            case, adapter, defended, canaries=canaries, tool_binding=tool_binding
        )
        records.append(record)
        score = record.get("score") or {}
        mark = score.get("status", "broke")
        print(
            f"[{index}/{total}] {case_id} {mark}",
            file=sys.stderr,
            flush=True,
        )

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


def _status(record: dict) -> str:
    return record["score"].get("status", "broke")


def _is_skipped(record: dict) -> bool:
    return _status(record) == "skipped"


def _summarize(run_label: str, defended: bool, records: list[dict]) -> dict[str, Any]:
    """Build the summary with the defense rate overall and per category.

    Cases fall into four buckets:
        held / broke - the two scored outcomes; these form the denominator.
        skipped      - the agent lacked a capability, so the attack could not
                       land. N/A: out of the denominator, never a pass.
        unverifiable - the attack landed but a check could not be evaluated
                       (for example a leak check with no prompt or canary).
                       Also out of the denominator, because reporting it as
                       held would claim a safety plop cannot see. It is counted
                       and listed on its own so the coverage gap stays loud.
    """
    scored = [r for r in records if _status(r) in ("held", "broke")]
    skipped = [r for r in records if _status(r) == "skipped"]
    unverifiable = [r for r in records if _status(r) == "unverifiable"]

    total = len(scored)
    passed = sum(1 for r in scored if _status(r) == "held")

    by_cat: dict[str, dict[str, int]] = {}
    for r in scored:
        cat = r["category"]
        bucket = by_cat.setdefault(cat, {"total": 0, "passed": 0})
        bucket["total"] += 1
        if _status(r) == "held":
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
                c["name"] for c in r["score"]["checks"] if c["passed"] is False
            ],
        }
        for r in scored
        if _status(r) == "broke"
    ]

    skipped_cases = [
        {
            "case_id": r["case_id"],
            "category": r["category"],
            "reason": r["score"].get("skipped_reason", ""),
        }
        for r in skipped
    ]

    unverifiable_cases = [
        {
            "case_id": r["case_id"],
            "category": r["category"],
            "unverifiable_checks": [
                c["name"] for c in r["score"]["checks"] if c["passed"] is None
            ],
        }
        for r in unverifiable
    ]

    return {
        "run_label": run_label,
        "defended": defended,
        "total": total,
        "passed": passed,
        "skipped": len(skipped),
        "unverifiable": len(unverifiable),
        "defense_rate": round(passed / total, 3) if total else 0.0,
        "per_category": per_category,
        "failed_cases": failed_cases,
        "skipped_cases": skipped_cases,
        "unverifiable_cases": unverifiable_cases,
    }


def _score_to_dict(score: CaseScore) -> dict[str, Any]:
    return {
        "case_id": score.case_id,
        "category": score.category,
        "status": score.status,
        "passed": score.passed,
        "skipped": False,
        "checks": [
            {"name": c.name, "passed": c.passed, "detail": c.detail}
            for c in score.checks
        ],
    }


__all__ = ["load_suite", "build_config", "run_case", "run_suite"]
