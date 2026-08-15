"""Tests for the adapter seam (asd-ste100).

The adapters are the contract between the harness and any agent. These tests
prove: the payload and transcript shapes, the command adapter end to end, the
http adapter against a local server, and the full suite through an external
adapter.
"""

from __future__ import annotations

import http.server
import json
import sys
import threading

import pytest

from plop.adapters import (
    BuiltinAdapter,
    CommandAdapter,
    HttpAdapter,
    case_payload,
    normalize_transcript,
)
from plop.harness import load_suite, run_suite

# A minimal external agent: reads a case from stdin, prints a transcript.
_STUB_AGENT = """
import json, sys
case = json.load(sys.stdin)
json.dump({
    "final_text": "I refuse. (%s)" % case["id"],
    "stop_reason": "end_turn",
    "iterations": 1,
    "tool_calls": [],
    "writes": [],
}, sys.stdout)
"""


# -- the contract shapes ------------------------------------------------------


def test_case_payload_has_the_documented_fields():
    case = load_suite()[0]
    payload = case_payload(case, defended=True)
    assert set(payload) == {
        "id",
        "category",
        "prompt",
        "task_mode",
        "allowed_tools",
        "defended",
        "expected_safe_behavior",
    }
    assert payload["defended"] is True


def test_normalize_transcript_fills_defaults():
    out = normalize_transcript({"final_text": "done"}, source="test")
    assert out["stop_reason"] == ""
    assert out["tool_calls"] == [] and out["writes"] == []


def test_normalize_transcript_rejects_bad_shapes():
    with pytest.raises(ValueError, match="final_text"):
        normalize_transcript({}, source="test")
    with pytest.raises(ValueError, match="JSON object"):
        normalize_transcript("just text", source="test")
    with pytest.raises(ValueError, match="tool_calls"):
        normalize_transcript({"final_text": "x", "tool_calls": "no"}, source="test")


def test_builtin_adapter_returns_the_contract_shape():
    transcript = BuiltinAdapter().run_case(load_suite()[0], defended=True)
    normalized = normalize_transcript(transcript, source="builtin")
    assert normalized["stop_reason"] == "end_turn"
    assert isinstance(normalized["tool_calls"], list)


# -- command adapter ----------------------------------------------------------


def test_command_adapter_round_trip(tmp_path):
    script = tmp_path / "stub_agent.py"
    script.write_text(_STUB_AGENT, encoding="utf-8")
    adapter = CommandAdapter([sys.executable, str(script)])
    case = load_suite()[0]
    out = adapter.run_case(case, defended=False)
    assert case["id"] in out["final_text"]
    assert out["stop_reason"] == "end_turn"


def test_command_adapter_fails_loudly_on_bad_output(tmp_path):
    script = tmp_path / "broken_agent.py"
    script.write_text("print('this is not json')", encoding="utf-8")
    adapter = CommandAdapter([sys.executable, str(script)])
    with pytest.raises(ValueError, match="valid JSON"):
        adapter.run_case(load_suite()[0], defended=False)


def test_full_suite_through_an_external_adapter(tmp_path):
    script = tmp_path / "stub_agent.py"
    script.write_text(_STUB_AGENT, encoding="utf-8")
    adapter = CommandAdapter([sys.executable, str(script)])
    summary = run_suite(
        "t-external", defended=True, adapter=adapter, results_dir=tmp_path
    )
    # The stub never exposes its system prompt or a canary, so the four
    # prompt-leak cases are unverifiable, not silent passes: plop cannot see a
    # leak, so it refuses to score one either way. They drop out of the
    # denominator and are reported on their own.
    assert summary["unverifiable"] == 4
    assert summary["total"] + summary["unverifiable"] + summary["skipped"] == 20
    assert summary["total"] == 16
    # The unverifiable cases are exactly the ones whose check could not run.
    for c in summary["unverifiable_cases"]:
        assert "forbidden_system_prompt" in c["unverifiable_checks"]
    # The stub calls no tools, so of the scored cases it defends all but the
    # one that needs the agent to report a data error in words.
    assert summary["passed"] >= summary["total"] - 1
    assert summary["adapter"]["adapter"] == "command"
    assert (tmp_path / "run-t-external.json").exists()


# -- http adapter -------------------------------------------------------------


class _StubHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers["Content-Length"])
        case = json.loads(self.rfile.read(length))
        body = json.dumps(
            {
                "final_text": f"I refuse. ({case['id']})",
                "stop_reason": "end_turn",
                "iterations": 1,
                "tool_calls": [],
                "writes": [],
            }
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # keep test output quiet
        pass


def test_http_adapter_round_trip():
    server = http.server.HTTPServer(("127.0.0.1", 0), _StubHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/"
        adapter = HttpAdapter(url, timeout=10)
        case = load_suite()[0]
        out = adapter.run_case(case, defended=True)
        assert case["id"] in out["final_text"]
        assert adapter.describe() == {"adapter": "http", "url": url}
    finally:
        server.shutdown()
