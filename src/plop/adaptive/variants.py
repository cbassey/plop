"""Deterministic adaptive variants (asd-ste100, Phase 4).

Adaptivity is worth nothing if the two arms of a study see different attacks. A
defended run that got easier variants than the naive run would post a better
number for the wrong reason. So plop keeps a strict discipline:

    generate ─▶ freeze ─▶ replay

    generate  Expand each base case into surface variants, deterministically.
              Same seed, same variants — every time, on every machine.
    freeze    Write the expanded set to one suite file. That file is the
              artifact of record. Nothing regenerates at run time.
    replay    Run both arms against the one frozen file. Identical attacks,
              identical order, identical ids. The comparison is fair by
              construction.

The variant operators here are **semantics-preserving frames**: they wrap the
prompt in benign text but never remove a trigger word or alter a quoted payload,
so the attack still lands exactly as the base case does. This tests whether a
defense holds across surface rewording, not just the one literal phrasing in the
base suite. Richer, gap-seeking operators (encoding tricks, reordering) plug into
the same freeze/replay harness; the discipline is the point, the operator set is
extensible.
"""

from __future__ import annotations

import copy
import hashlib
import random

# Benign wrappers. None contains a word the naive backend keys on (no "record",
# "system prompt", "write", "search", "again", quotes), so a frame changes the
# surface form without changing which attack the case delivers.
_PREFIXES = [
    "",
    "Quick favor: ",
    "When you have a moment, ",
    "As we talked about earlier, ",
    "Hi there. ",
    "One thing for me: ",
]
_SUFFIXES = [
    "",
    "\n\nThanks in advance.",
    "\n\nAppreciate the help.",
    "\n\nLet me know if anything is unclear.",
    "\n\nNo rush on this.",
]


def _frame_deck(seed: int, case_id: str) -> list[tuple[str, str]]:
    """The per-case deck of (prefix, suffix) frames, deterministically ordered.

    The identity frame ("", "") is dropped: every variant must differ from its
    base. The order is fixed by (seed, case_id), so it is stable across runs and
    machines — no reliance on the salted built-in hash().
    """
    combos = [
        (p, s) for p in _PREFIXES for s in _SUFFIXES if (p, s) != ("", "")
    ]
    digest = hashlib.sha256(f"{seed}:{case_id}".encode("utf-8")).hexdigest()
    rng = random.Random(int(digest[:16], 16))
    rng.shuffle(combos)
    return combos


def mutate_case(case: dict, seed: int, count: int) -> list[dict]:
    """Return `count` deterministic surface variants of one base case.

    Each variant keeps the base case's category, checks, task_mode, and
    allowed_tools — only the prompt's surface form changes — so it is the same
    attack in different words. Variants are ids `{base}~v1`, `{base}~v2`, …
    """
    if count <= 0:
        return []
    case_id = case.get("id", "case")
    deck = _frame_deck(seed, case_id)
    variants: list[dict] = []
    for k in range(count):
        prefix, suffix = deck[k % len(deck)]
        variant = copy.deepcopy(case)
        variant["id"] = f"{case_id}~v{k + 1}"
        variant["prompt"] = f"{prefix}{case.get('prompt', '')}{suffix}"
        variant["variant_of"] = case_id
        variant["frame"] = {"prefix": prefix, "suffix": suffix}
        variants.append(variant)
    return variants


def expand_suite(
    base_cases: list[dict], seed: int, variants_per_case: int
) -> list[dict]:
    """Expand a base suite into base + variants, deterministically.

    Each base case is kept as-is and immediately followed by its variants, so
    the frozen file reads base, its variants, next base, its variants. Same
    seed and inputs always give byte-identical output.
    """
    expanded: list[dict] = []
    for case in base_cases:
        expanded.append(copy.deepcopy(case))
        expanded.extend(mutate_case(case, seed, variants_per_case))
    return expanded


__all__: list[str] = ["mutate_case", "expand_suite"]
