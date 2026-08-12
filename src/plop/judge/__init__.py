"""plop.judge — an advisory model reviewer that never gates.

The scorer computes the number. The judge runs afterward, on the saved run
artifact, and can only add a `judgment` annotation per case and a list of
disagreements for a human to review. It has no path to change the defense rate.
Hard checks gate; the judge explains. See base.py for the contract.
"""

from __future__ import annotations

from .annotate import annotate_run
from .base import Judge, Judgment, annotate_records
from .llm_judge import LlmJudge
from .rule_judge import RuleAgreementJudge

__all__ = [
    "Judgment",
    "Judge",
    "annotate_records",
    "annotate_run",
    "RuleAgreementJudge",
    "LlmJudge",
]
