"""The advisory judge contract (asd-ste100, Phase 4).

A judge reads a scored case and writes an opinion. It never changes the score.
This is a hard architectural rule, not a convention: the scorer runs first and
its result is the number; the judge runs afterward, on the saved artifact, and
can only attach a `judgment` annotation and a separate list of disagreements.
There is no code path by which a judge flips held to broke or moves the defense
rate. Hard checks gate; the judge explains.

Why keep a judge at all, if it cannot gate? Two reasons. It flags cases where a
model reviewer disagrees with the mechanical check — those are the cases a human
should look at, in either direction (a check that fired on benign output, or a
subtle harm the checks missed). And it turns a bare pass/fail into a readable
rationale. Both are review aids, and neither is allowed to touch the number.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Protocol

# The scored outcomes a judge is allowed to annotate. Skipped and unverifiable
# cases have no behaviour to judge, so the judge leaves them alone.
_ANNOTATABLE = ("held", "broke")


@dataclass
class Judgment:
    """One judge's advisory opinion on a scored case.

    verdict: "agree" (the hard check looks right), "disagree" (a human should
        look — the check may be wrong in either direction), or "unsure".
    rationale: a short, human-readable reason.
    confidence: 0.0–1.0, the judge's own confidence in its verdict.
    advisory: always True. It is here to make the contract legible in the
        serialized record: this field never gates.
    """

    verdict: str
    rationale: str
    confidence: float = 0.0
    advisory: bool = True


class Judge(Protocol):
    """Reads one scored run record and returns an advisory Judgment."""

    def judge(self, record: dict) -> Judgment:
        ...


def annotate_records(records: list[dict], judge: Judge) -> dict:
    """Attach an advisory judgment to each scored record, in place.

    Returns a summary addendum: how many cases were judged, and the list of
    cases where the judge disagreed with the hard check (the review queue). This
    function reads and writes only the `judgment` field. It never reads or writes
    `score`, so it cannot change the defense rate. That is the whole safety
    argument, and test_judge_is_advisory_only pins it.
    """
    judged = 0
    disagreements: list[dict] = []
    for record in records:
        score = record.get("score") or {}
        if score.get("status") not in _ANNOTATABLE:
            continue
        judgment = judge.judge(record)
        record["judgment"] = asdict(judgment)
        judged += 1
        if judgment.verdict == "disagree":
            disagreements.append(
                {
                    "case_id": record.get("case_id"),
                    "category": record.get("category"),
                    "hard_check_status": score.get("status"),
                    "rationale": judgment.rationale,
                    "confidence": judgment.confidence,
                }
            )
    return {"judged": judged, "disagreements": disagreements}


__all__ = ["Judgment", "Judge", "annotate_records"]
