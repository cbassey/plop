"""Annotate a saved run with an advisory judge (asd-ste100, Phase 4).

This runs on the artifact the scorer already wrote. It reads results/run-*.json,
attaches a judgment to every scored record, and adds a `judge` block to the
summary with the count and the disagreement queue. It rewrites the same file (or
a new one) and, by construction, leaves every `score` and the `defense_rate`
untouched — the judge is advisory.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .base import Judge, annotate_records


def annotate_run(
    run_path: str | Path, judge: Judge, out_path: Optional[str | Path] = None
) -> dict:
    """Annotate a saved run file in place (or to out_path) and return the data.

    The defense rate is copied through verbatim: this function never recomputes
    or touches the score. It only adds `judgment` fields and a `summary.judge`
    block.
    """
    run_path = Path(run_path)
    data = json.loads(run_path.read_text(encoding="utf-8"))

    records = data.get("records", [])
    rate_before = (data.get("summary") or {}).get("defense_rate")

    addendum = annotate_records(records, judge)
    data.setdefault("summary", {})["judge"] = addendum

    # A belt-and-braces check that the advisory contract held.
    rate_after = data["summary"].get("defense_rate")
    if rate_after != rate_before:
        raise AssertionError(
            "the judge changed the defense rate; annotation must be advisory only"
        )

    target = Path(out_path) if out_path else run_path
    target.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return data


__all__ = ["annotate_run"]
