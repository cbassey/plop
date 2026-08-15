"""Freeze and replay an adaptive suite (asd-ste100, Phase 4).

`freeze_suite` writes an expanded suite to one file — the artifact of record.
`replay_paired` runs the naive and defended arms against that one file, so both
arms see identical attacks in identical order. The fairness guarantee is
structural: there is one file, and both arms load it.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import yaml

from plop.adapters import AgentAdapter
from plop.harness import load_suite, run_suite

from .variants import expand_suite


def freeze_suite(
    cases: list[dict], path: str | Path, seed: Optional[int] = None
) -> Path:
    """Write the expanded cases to a frozen suite file.

    The file carries a header naming it as frozen and recording the seed, so a
    reader never mistakes it for a hand-authored suite or regenerates it by
    accident.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    body = yaml.safe_dump({"cases": cases}, sort_keys=False, allow_unicode=True)
    header = (
        "# Frozen adaptive suite — generated, do not edit by hand.\n"
        f"# seed: {seed}\n"
        f"# cases: {len(cases)}\n"
    )
    path.write_text(header + body, encoding="utf-8")
    return path


def generate_frozen_suite(
    seed: int,
    variants_per_case: int,
    out_path: str | Path,
    base_suite_path: Optional[str | Path] = None,
) -> Path:
    """Expand the base suite and freeze it in one step. Returns the file path."""
    base = load_suite(base_suite_path) if base_suite_path else load_suite()
    expanded = expand_suite(base, seed, variants_per_case)
    return freeze_suite(expanded, out_path, seed=seed)


def replay_paired(
    frozen_path: str | Path,
    label_prefix: str,
    adapter_factory=None,
    results_dir: str | Path = "results",
    **run_kwargs: Any,
) -> dict[str, Any]:
    """Replay the naive and defended arms against one frozen suite.

    Both arms load `frozen_path`, so they see the same attacks. Returns both
    summaries plus a `fair` flag that is True only when the two arms actually
    scored the same set of case ids — a self-check that the discipline held.

    `adapter_factory` makes a fresh adapter per arm (a stateful adapter must not
    be shared). When None, the builtin adapter is used via run_suite's default.
    """
    frozen_path = Path(frozen_path)

    def _run(defended: bool) -> dict[str, Any]:
        adapter: Optional[AgentAdapter] = (
            adapter_factory() if adapter_factory is not None else None
        )
        label = f"{label_prefix}-{'defended' if defended else 'naive'}"
        return run_suite(
            label,
            defended=defended,
            adapter=adapter,
            suite_path=frozen_path,
            results_dir=results_dir,
            **run_kwargs,
        )

    naive = _run(False)
    defended = _run(True)

    fair = _scored_ids(naive, results_dir) == _scored_ids(defended, results_dir)
    return {"naive": naive, "defended": defended, "fair": fair}


def _scored_ids(summary: dict, results_dir: str | Path) -> set[str]:
    """The set of case ids that actually produced a run in this arm."""
    path = Path(results_dir) / f"run-{summary['run_label']}.json"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {r["case_id"] for r in data.get("records", [])}


__all__ = ["freeze_suite", "generate_frozen_suite", "replay_paired"]
