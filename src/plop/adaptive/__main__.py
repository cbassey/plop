"""Command-line entry for adaptive generate/freeze/replay (asd-ste100, Phase 4).

Expand the base suite into deterministic surface variants, freeze them to one
file, and (optionally) replay both study arms against that one file:

    # Freeze a variant suite. Same seed always gives the same file.
    python -m plop.adaptive --seed 7 --variants 3 --out results/adaptive-suite.yaml

    # Freeze and immediately replay both arms against the frozen file.
    python -m plop.adaptive --seed 7 --variants 3 \
        --out results/adaptive-suite.yaml --replay --label adaptive

Replay uses the builtin adapter. Both arms load the one frozen file, so the
before/after comparison is fair by construction; the printed `fair` flag is a
self-check that the two arms scored the identical case set.
"""

from __future__ import annotations

import argparse
import sys

from .freeze import generate_frozen_suite, replay_paired


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate, freeze, and replay an adaptive variant suite."
    )
    parser.add_argument("--seed", type=int, required=True, help="Deterministic seed.")
    parser.add_argument(
        "--variants", type=int, default=3, help="Variants per base case."
    )
    parser.add_argument(
        "--out", required=True, help="Where to write the frozen suite file."
    )
    parser.add_argument(
        "--base", help="A base suite path. Defaults to plop's own adversarial suite."
    )
    parser.add_argument(
        "--replay",
        action="store_true",
        help="After freezing, run the naive and defended arms against the file.",
    )
    parser.add_argument(
        "--label", default="adaptive", help="Run label prefix for --replay."
    )
    parser.add_argument(
        "--results-dir", default="results", help="Output folder for --replay runs."
    )
    args = parser.parse_args(argv)

    frozen = generate_frozen_suite(
        seed=args.seed,
        variants_per_case=args.variants,
        out_path=args.out,
        base_suite_path=args.base,
    )
    print(f"Froze adaptive suite: {frozen}", file=sys.stderr)

    if not args.replay:
        return 0

    result = replay_paired(frozen, args.label, results_dir=args.results_dir)
    naive, defended = result["naive"], result["defended"]
    print(
        f"\nReplay (fair={result['fair']}): "
        f"naive {naive['defense_rate']} ({naive['passed']}/{naive['total']}) -> "
        f"defended {defended['defense_rate']} "
        f"({defended['passed']}/{defended['total']})",
        file=sys.stderr,
    )
    if not result["fair"]:
        print(
            "WARNING: the two arms did not score the same case set; the "
            "comparison is not fair. Do not trust the before/after.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
