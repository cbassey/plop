"""Command-line entry for the advisory judge (asd-ste100, Phase 4).

The judge is a post-processor. Score a run first, then annotate the saved
artifact — the judge cannot change the number by design:

    # A run the scorer already wrote.
    python -m plop.harness --label my-agent --profile profiles/quill.json

    # Annotate it with the offline rule judge (no API key).
    python -m plop.judge --run results/run-my-agent.json

    # Or a live model reviewer for a real second opinion.
    python -m plop.judge --run results/run-my-agent.json --judge anthropic

The exit code is always 0 when the file was annotated; disagreements are a
review signal, not a failure. They are printed to stderr and stored in the
summary's `judge.disagreements` block.
"""

from __future__ import annotations

import argparse
import sys

from .annotate import annotate_run


def _build_judge(kind: str, model: str):
    if kind == "rule":
        from .rule_judge import RuleAgreementJudge

        return RuleAgreementJudge()
    if kind == "anthropic":
        from plop.agent import AnthropicBackend

        from .llm_judge import LlmJudge

        return LlmJudge(AnthropicBackend(model=model))
    raise ValueError(f"unknown judge {kind!r}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Attach an advisory judgment to a scored run. Never gates."
    )
    parser.add_argument("--run", required=True, help="Path to a results/run-*.json file.")
    parser.add_argument(
        "--judge",
        choices=["rule", "anthropic"],
        default="rule",
        help="'rule' is offline and deterministic. 'anthropic' needs an API key.",
    )
    parser.add_argument(
        "--model", default="claude-sonnet-5", help="Model id for the anthropic judge."
    )
    parser.add_argument(
        "--out", help="Write the annotated run here instead of overwriting --run."
    )
    args = parser.parse_args(argv)

    judge = _build_judge(args.judge, args.model)
    data = annotate_run(args.run, judge, out_path=args.out)

    block = (data.get("summary") or {}).get("judge") or {}
    disagreements = block.get("disagreements") or []
    print(
        f"Judged {block.get('judged', 0)} case(s). "
        f"The defense rate is unchanged (advisory judge).",
        file=sys.stderr,
    )
    if disagreements:
        print(
            f"\n{len(disagreements)} case(s) for human review "
            f"(the judge disagreed with the hard check):",
            file=sys.stderr,
        )
        for d in disagreements:
            print(
                f"  - {d['case_id']} [{d['category']}] "
                f"hard={d['hard_check_status']} conf={d['confidence']}: {d['rationale']}",
                file=sys.stderr,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
