"""Command-line entry for the plop harness (asd-ste100).

Examples:
    # Offline smoke run with the mock backend.
    python -m harness --label naive-mock

    # Real naive run against the Claude API.
    python -m harness --label naive --backend anthropic

    # Real defended run against the Claude API.
    python -m harness --label defended --backend anthropic --defended
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
        choices=["mock", "anthropic"],
        default="mock",
        help="The model backend. 'mock' runs offline. 'anthropic' needs an API key.",
    )
    parser.add_argument(
        "--model",
        default="claude-sonnet-5",
        help="The model id for the anthropic backend.",
    )
    args = parser.parse_args(argv)

    backend = None
    if args.backend == "anthropic":
        from agent import AnthropicBackend

        backend = AnthropicBackend(model=args.model)

    summary = run_suite(
        run_label=args.label,
        defended=args.defended,
        backend=backend,
        model=args.model,
    )

    json.dump(summary, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
