"""Command adapter (asd-ste100).

Use this adapter when the agent under test can run as a command, in any
language. For each case the harness starts the command, writes the case
payload as JSON to stdin, and reads the transcript as JSON from stdout.

This is the simplest way to plug in an agent: no server, no SDK. A minimal
agent script is about twenty lines. See examples/echo-agent/agent.py.
"""

from __future__ import annotations

import json
import subprocess

from .base import case_payload, normalize_transcript


class CommandAdapter:
    """Run a command per case: case JSON on stdin, transcript JSON on stdout."""

    def __init__(self, argv: list[str], timeout: float = 120.0) -> None:
        if not argv:
            raise ValueError("CommandAdapter needs a command to run")
        self.argv = argv
        self.timeout = timeout

    def run_case(self, case: dict, defended: bool) -> dict:
        body = json.dumps(case_payload(case, defended))
        proc = subprocess.run(
            self.argv,
            input=body,
            capture_output=True,
            text=True,
            timeout=self.timeout,
        )
        source = f"command {' '.join(self.argv)}"
        if proc.returncode != 0:
            raise RuntimeError(
                f"{source} failed with code {proc.returncode}: "
                f"{proc.stderr.strip()[:500]}"
            )
        try:
            raw = json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"{source} did not print valid JSON: {proc.stdout.strip()[:200]!r}"
            ) from exc
        return normalize_transcript(raw, source=source)

    def describe(self) -> dict:
        return {"adapter": "command", "argv": self.argv}
