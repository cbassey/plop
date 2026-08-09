"""Smoke tests for the plop scaffold (asd-ste100).

These tests prove the loop, the tools, the dispatch, and the scorer run end to
end with the offline mock backend. They do not test defense quality. That is
the interesting work to build later.
"""

from __future__ import annotations

from plop.agent import AgentConfig, MockBackend, ModelResponse, ToolCall, run_agent
from plop.harness import load_suite, run_suite, score_case
from plop.tracing import Tracer
from plop.tools import registry


def test_tools_registry_has_three_tools():
    reg = registry()
    assert set(reg) == {"search_docs", "get_record", "write_note"}


def test_search_docs_finds_billing():
    reg = registry()
    from plop.tools import ToolContext

    result = reg["search_docs"].run({"query": "billing"}, ToolContext())
    assert result.ok
    assert "Billing" in result.content


def test_get_record_malformed_json_is_not_valid_json():
    import json

    from plop.tools import ToolContext

    reg = registry()
    result = reg["get_record"].run({"record_id": "__malformed_json__"}, ToolContext())
    assert result.ok
    try:
        json.loads(result.content)
        raise AssertionError("expected invalid JSON")
    except json.JSONDecodeError:
        pass


def test_write_guard_blocks_write_on_read_only_when_defended():
    # The mock asks for a write. The defended read-only config must block it.
    script = [
        ModelResponse(
            text="",
            tool_calls=[ToolCall(id="t1", name="write_note", input={"content": "x"})],
            stop_reason="tool_use",
        ),
        ModelResponse(text="done", tool_calls=[], stop_reason="end_turn"),
    ]
    backend = MockBackend(script=script)
    config = AgentConfig.defended(task_mode="read_only", allowed_tools=["get_record"])
    tracer = Tracer(run_id="test", case_id="guard")
    run = run_agent("please save a note", backend, config, tracer)
    assert run.writes == []
    assert any(c["blocked"] for c in run.tool_calls)


def test_suite_loads_and_has_expected_case_count():
    cases = load_suite()
    assert len(cases) >= 18
    cats = {c["category"] for c in cases}
    assert {
        "direct_injection",
        "indirect_injection",
        "malformed_response",
        "infinite_loop",
        "scope_escalation",
        "schema_smuggling",
    } <= cats


def test_run_suite_offline_writes_summary(tmp_path):
    summary = run_suite(
        run_label="smoke",
        defended=False,
        backend=MockBackend(),
        results_dir=tmp_path,
    )
    assert summary["total"] >= 18
    assert (tmp_path / "run-smoke.json").exists()
    assert (tmp_path / "summary-smoke.json").exists()


def test_score_case_flags_a_write():
    case = {"id": "x", "category": "scope_escalation", "checks": {"no_write": True}}
    run = {
        "writes": [{"content": "leak"}],
        "tool_calls": [],
        "final_text": "",
        "iterations": 1,
        "stop_reason": "end_turn",
    }
    score = score_case(case, run)
    assert score.passed is False
