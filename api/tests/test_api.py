"""Tests for the plop API (asd-ste100).

The run tests use the offline `naive` backend, so they need no API key and
no network.
"""

from __future__ import annotations

import json
import os
import time

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    demo = tmp_path / "demo"
    demo.mkdir()
    (demo / "run-sample-naive.json").write_text(
        json.dumps(
            {
                "summary": {"defended": False, "defense_rate": 0.1, "total": 10},
                "records": [{"case_id": "c1", "run": {"events": [1, 2], "ok": True}}],
            }
        )
    )
    (demo / "run-sample-defended.json").write_text(
        json.dumps({"summary": {"defended": True, "defense_rate": 0.9, "total": 10}})
    )
    monkeypatch.setenv("PLOP_HOSTED", "1")
    monkeypatch.setenv("PLOP_RESULTS_DIR", str(demo))
    monkeypatch.setenv("PLOP_RUNS_DIR", str(tmp_path / "runs"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-owner-key-do-not-lend")

    from plop_api.main import app

    return TestClient(app)


def test_health_reports_hosted(client):
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert body["hosted"] is True
    # The host never lends its own key to a visitor.
    assert body["anthropicKey"] is False


def test_results_pair_runs_into_studies(client):
    studies = client.get("/api/results").json()["studies"]
    assert [s["name"] for s in studies] == ["sample"]
    study = studies[0]
    assert study["naive"]["summary"]["defense_rate"] == 0.1
    assert study["defended"]["summary"]["defense_rate"] == 0.9
    # The event log is dropped from the list payload.
    assert "events" not in study["naive"]["records"][0]["run"]


def test_each_session_sees_only_its_own_runs(client):
    a = client.get("/api/results", headers={"X-Plop-Session": "aaa"}).json()
    assert [s["name"] for s in a["studies"]] == ["sample"]


def test_hosted_service_refuses_to_store_a_key(client):
    res = client.put("/api/secrets", json={"anthropic_api_key": "sk-test-123"})
    assert res.status_code == 403
    assert "never stores" in res.json()["error"]
    assert client.get("/api/secrets").json()["storage"] == "none"


def test_live_backend_without_a_key_is_refused(client):
    res = client.post(
        "/api/runs", json={"mode": "builtin", "label": "x", "backend": "anthropic"}
    )
    assert res.status_code == 400
    assert "API key" in res.json()["error"]


def test_conformance_needs_a_prompt(client):
    res = client.post("/api/runs", json={"mode": "conformance", "label": "x"})
    assert res.status_code == 400


def test_command_adapter_is_refused_when_hosted(client):
    res = client.post(
        "/api/runs",
        json={
            "mode": "capability",
            "label": "x",
            "adapter": "command",
            "command": "echo hi",
        },
    )
    assert res.status_code == 400
    assert "cannot run a shell command" in res.json()["error"]


def test_unknown_job_is_404(client):
    assert client.get("/api/jobs/nope").status_code == 404


def test_sample_study_cannot_be_deleted(client):
    res = client.delete("/api/studies/sample", headers={"X-Plop-Session": "aaa"})
    assert res.status_code == 403


@pytest.mark.skipif(
    not os.path.exists(os.path.join(os.getcwd(), "src", "plop")),
    reason="run from the repo root, where the plop package lives",
)
def test_builtin_run_writes_a_study_for_that_session(client):
    started = client.post(
        "/api/runs",
        json={"mode": "builtin", "label": "api-test", "backend": "naive"},
        headers={"X-Plop-Session": "sess1"},
    )
    assert started.status_code == 202
    job_id = started.json()["id"]

    deadline = time.time() + 240
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "failed"):
            break
        time.sleep(1)
    assert job["status"] == "done", job.get("error") or job["log"][-800:]

    mine = client.get("/api/results", headers={"X-Plop-Session": "sess1"}).json()
    names = [s["name"] for s in mine["studies"]]
    assert "api-test" in names
    study = next(s for s in mine["studies"] if s["name"] == "api-test")
    assert study["naive"] and study["defended"]

    # A different visitor does not see it.
    other = client.get("/api/results", headers={"X-Plop-Session": "sess2"}).json()
    assert "api-test" not in [s["name"] for s in other["studies"]]

    # The owner can delete their own study.
    assert (
        client.delete(
            "/api/studies/api-test", headers={"X-Plop-Session": "sess1"}
        ).status_code
        == 200
    )
