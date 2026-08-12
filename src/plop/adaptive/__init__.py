"""plop.adaptive — deterministic variant generation with freeze/replay.

Adaptivity that stays honest: expand the base suite into surface variants
(generate), write them to one artifact (freeze), and run both study arms against
that one artifact (replay). Both arms see identical attacks, so the before/after
number stays a fair comparison. See variants.py for the discipline.
"""

from __future__ import annotations

from .freeze import freeze_suite, generate_frozen_suite, replay_paired
from .variants import expand_suite, mutate_case

__all__ = [
    "mutate_case",
    "expand_suite",
    "freeze_suite",
    "generate_frozen_suite",
    "replay_paired",
]
