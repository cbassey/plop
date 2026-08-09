"""Command-line entry for the plop harness (asd-ste100).

Backends:
    naive      - a deterministic worst-case agent that obeys every instruction.
                 This is the study default. It needs no API key.
    mock       - a safe stub that refuses everything. Use it to smoke-test the
                 pipeline. It needs no API key.
    anthropic  - a live Claude model. It needs ANTHROPIC_API_KEY.

Examples:
    # The before/after study, offline and deterministic.
    python -m harness --label naive
    python -m harness --label defended --defended

    # A live run against the Claude API.
    python -m harness --label naive-live   --backend anthropic
    python -m harness --label defended-live --backend anthropic --defended
"""

from __future__ import annotations

import argparse
import json
import sys

from .runner import run_suite


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the plop adversarial suite.")
    parser.add_argument("--label", required=True, help="A short label for the run.")
    parser.add_argument(
        "--defended",
        action="store_true",
        help="Turn the defenses on. Omit for a naive run.",
    )
    parser.add_argument(
        "--backend",
        choices=["naive", "mock", "anthropic"],
        default="naive",
        help="The model backend. 'naive' and 'mock' run offline. 'anthropic' needs an API key.",
    )
    parser.add_argument(
        "--model",
        default="claude-sonnet-5",
        help="The model id for the anthropic backend.",
    )
    args = parser.parse_args(argv)

    backend = None
    backend_factory = None
    if args.backend == "naive":
        from agent import NaiveVulnerableBackend

        backend_factory = lambda: NaiveVulnerableBackend()  # noqa: E731
    elif args.backend == "mock":
        from agent import MockBackend

        backend_factory = lambda: MockBackend()  # noqa: E731
    elif args.backend == "anthropic":
        from agent import AnthropicBackend

        # One live backend instance is fine; it holds no per-case state.
        backend = AnthropicBackend(model=args.model)

    summary = run_suite(
        run_label=args.label,
        defended=args.defended,
        backend=backend,
        backend_factory=backend_factory,
        model=args.model,
    )

    json.dump(summary, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
