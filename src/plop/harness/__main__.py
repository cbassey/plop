"""Command-line entry for the plop harness (asd-ste100).

The turnkey way to test any agent is a profile:

    # Conformance mode: plop's tools and guards, the agent's prompt and model.
    python -m plop.harness --label quill          --profile profiles/quill.json
    python -m plop.harness --label quill-defended --profile profiles/quill.json --defended

A conformance profile needs only a name and a system_prompt. plop provides
every capability, so the whole suite runs. See profiles/quill.json.

Adapters (the lower-level way to pick which agent gets attacked):
    builtin    - plop's own demo agent. The study default.
    http       - any agent behind an HTTP endpoint. Needs --url.
    command    - any agent runnable as a command. Needs --command.

Backends (for the builtin adapter only):
    naive      - a deterministic worst-case agent that obeys every instruction.
                 This is the study default. It needs no API key.
    mock       - a safe stub that refuses everything. Use it to smoke-test the
                 pipeline. It needs no API key.
    anthropic  - a live Claude model. It needs ANTHROPIC_API_KEY.

Examples:
    # The before/after study, offline and deterministic.
    python -m plop.harness --label naive
    python -m plop.harness --label defended --defended

    # A live run against the Claude API.
    python -m plop.harness --label naive-live   --backend anthropic
    python -m plop.harness --label defended-live --backend anthropic --defended

    # Attack your own agent over HTTP or a command.
    python -m plop.harness --label my-agent --adapter http \
        --url http://localhost:3000/api/plop
    python -m plop.harness --label my-agent --adapter command \
        --command "node run-agent.js"
"""

from __future__ import annotations

import argparse
import json
import shlex
import sys

from .runner import run_suite


def _emit(summary: dict) -> None:
    """Print the summary JSON, then a loud note about any coverage gap.

    Unverifiable cases (a check plop could not evaluate, for example a leak
    check against an agent that never exposes its prompt) are left out of the
    defense rate. Say so, so the number is never read as full coverage.
    """
    json.dump(summary, sys.stdout, indent=2)
    sys.stdout.write("\n")
    unverifiable = summary.get("unverifiable", 0)
    if unverifiable:
        ids = ", ".join(c["case_id"] for c in summary.get("unverifiable_cases", []))
        print(
            f"\nNOTE: {unverifiable} case(s) are UNVERIFIABLE and are excluded "
            f"from the defense rate of {summary['defense_rate']} "
            f"({summary['passed']}/{summary['total']}). "
            f"plop could not evaluate a check for: {ids}. "
            f"Declare 'canaries' in the profile to make leak checks verifiable.",
            file=sys.stderr,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the plop adversarial suite.")
    parser.add_argument("--label", required=True, help="A short label for the run.")
    parser.add_argument(
        "--defended",
        action="store_true",
        help="Ask for a defended run. Omit for a naive run.",
    )
    parser.add_argument(
        "--profile",
        help="Path to an agent profile (JSON or YAML). The turnkey way to "
        "test any agent. A conformance profile needs only a name and a "
        "system_prompt. This wins over --adapter and --backend.",
    )
    parser.add_argument(
        "--adapter",
        choices=["builtin", "http", "command"],
        default="builtin",
        help="Which agent to attack: the builtin demo agent, an HTTP "
        "endpoint, or a command.",
    )
    parser.add_argument(
        "--url",
        help="The endpoint for the http adapter, for example "
        "http://localhost:3000/api/plop.",
    )
    parser.add_argument(
        "--command",
        help="The command for the command adapter. It gets the case JSON on "
        "stdin and must print the transcript JSON on stdout.",
    )
    parser.add_argument(
        "--backend",
        choices=["naive", "mock", "anthropic"],
        default="naive",
        help="The model backend for the builtin adapter. 'naive' and 'mock' "
        "run offline. 'anthropic' needs an API key.",
    )
    parser.add_argument(
        "--model",
        default="claude-sonnet-5",
        help="The model id for the anthropic backend.",
    )
    parser.add_argument(
        "--results-dir",
        help="The folder for the output files. It defaults to plop/results. "
        "The hosted API gives each visitor a folder of their own.",
    )
    args = parser.parse_args(argv)

    # Only send the argument when the user gives one, so the runner keeps
    # its own default.
    where = {"results_dir": args.results_dir} if args.results_dir else {}

    adapter = None
    backend = None
    backend_factory = None
    provided_capabilities = None

    if args.profile:
        from plop.conformance import AgentProfile, build_profile_run

        profile = AgentProfile.load(args.profile)
        adapter, provided_capabilities, tool_binding = build_profile_run(
            profile, args.label
        )
        summary = run_suite(
            run_label=args.label,
            defended=args.defended,
            adapter=adapter,
            provided_capabilities=provided_capabilities,
            canaries=profile.canaries,
            tool_binding=tool_binding,
            **where,
        )
        _emit(summary)
        return 0

    if args.adapter == "http":
        if not args.url:
            parser.error("--adapter http needs --url")
        from plop.adapters import HttpAdapter

        adapter = HttpAdapter(args.url)
    elif args.adapter == "command":
        if not args.command:
            parser.error("--adapter command needs --command")
        from plop.adapters import CommandAdapter

        adapter = CommandAdapter(shlex.split(args.command))
    elif args.backend == "naive":
        from plop.agent import NaiveVulnerableBackend

        backend_factory = lambda: NaiveVulnerableBackend()  # noqa: E731
    elif args.backend == "mock":
        from plop.agent import MockBackend

        backend_factory = lambda: MockBackend()  # noqa: E731
    elif args.backend == "anthropic":
        from plop.agent import AnthropicBackend

        # One live backend instance is fine; it holds no per-case state.
        backend = AnthropicBackend(model=args.model)

    summary = run_suite(
        run_label=args.label,
        defended=args.defended,
        adapter=adapter,
        backend=backend,
        backend_factory=backend_factory,
        model=args.model,
        **where,
    )

    _emit(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
