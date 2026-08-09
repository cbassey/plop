"""HTTP adapter (asd-ste100).

Use this adapter when the agent under test runs behind an HTTP endpoint, in
any language. The harness sends one POST per case with the case payload as
JSON. The endpoint runs its agent and returns the transcript as JSON.

This fits an agent that already lives in a web app. For example, a Next.js
agent adds one API route that maps the payload to its own run function. See
examples/quill/ for a worked example.

The adapter uses only the standard library, so plop keeps zero required
dependencies.
"""

from __future__ import annotations

import json
import urllib.request

from .base import case_payload, normalize_transcript


class HttpAdapter:
    """POST each case to a URL and read the transcript back."""

    def __init__(self, url: str, timeout: float = 120.0) -> None:
        self.url = url
        self.timeout = timeout

    def run_case(self, case: dict, defended: bool) -> dict:
        body = json.dumps(case_payload(case, defended)).encode("utf-8")
        request = urllib.request.Request(
            self.url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            raw = json.loads(response.read().decode("utf-8"))
        return normalize_transcript(raw, source=f"HTTP {self.url}")

    def describe(self) -> dict:
        return {"adapter": "http", "url": self.url}
