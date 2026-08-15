"""Run the suite and keep the job state (asd-ste100).

The API never runs the suite in its own process. It starts
`python -m plop.harness`, exactly as the CLI does, so the web app and the
CLI always score the same way. A subprocess also keeps one visitor's API
key out of every other run: the key goes in the environment of that child
and nowhere else.

Job state lives in memory. A restart of the service loses the jobs that
were running. The results a finished run wrote stay on disk.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from plop_api.config import (
    REPO_ROOT,
    hosted,
    max_concurrent_runs,
    profiles_root,
    python_bin,
)
from plop_api.secrets import load_secrets

CAPABILITIES = [
    "reads_untrusted_content",
    "returns_structured_record",
    "accepts_freeform_id",
    "has_write_tool",
]

LOG_LIMIT = 80_000
LOG_KEEP = 60_000


@dataclass
class Job:
    """One before/after study, or one side of one."""

    id: str
    mode: str
    label: str
    results_dir: Path
    pair: bool = True
    defended: bool = False
    backend: str = "naive"
    model: str = "claude-sonnet-5"
    judge: str = "off"
    profile_path: Optional[Path] = None
    api_key: Optional[str] = None
    status: str = "queued"
    log: str = ""
    error: Optional[str] = None
    study: Optional[str] = None
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    started_at: Optional[int] = None
    finished_at: Optional[int] = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def append_log(self, text: str) -> None:
        with self._lock:
            self.log += text
            if len(self.log) > LOG_LIMIT:
                self.log = self.log[-LOG_KEEP:]

    def public(self) -> dict[str, Any]:
        """The shape the browser polls. It never holds the key."""
        with self._lock:
            return {
                "id": self.id,
                "status": self.status,
                "mode": self.mode,
                "label": self.label,
                "study": self.study,
                "error": self.error,
                "log": self.log,
                "createdAt": self.created_at,
                "startedAt": self.started_at,
                "finishedAt": self.finished_at,
            }


_jobs: dict[str, Job] = {}
_jobs_lock = threading.Lock()
_pool = ThreadPoolExecutor(
    max_workers=max_concurrent_runs(), thread_name_prefix="plop-run"
)


def get_job(job_id: str) -> Optional[Job]:
    with _jobs_lock:
        return _jobs.get(job_id)


def sanitize_label(raw: Any) -> str:
    cleaned = "".join(
        ch if (ch.isalnum() and ch.isascii()) or ch in "_-" else "-"
        for ch in str(raw or "run").lower()
    ).strip("-")[:48]
    return cleaned or "run"


def normalize_judge(raw: Any) -> str:
    return raw if raw in ("rule", "anthropic") else "off"


def normalize_tools(raw: Any) -> list[dict[str, Any]]:
    """Keep named tools, and keep only the kinds plop knows."""
    if not isinstance(raw, list):
        return []
    tools = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        kinds = item.get("kinds")
        kinds = [k for k in kinds if k in CAPABILITIES] if isinstance(kinds, list) else []
        tools.append({"name": name, "kinds": kinds})
    return tools


def build_profile(body: dict[str, Any]) -> Optional[dict[str, Any]]:
    mode = body.get("mode")
    if mode == "conformance":
        return {
            "name": sanitize_label(body.get("label")),
            "mode": "conformance",
            "backend": body.get("backend") or "naive",
            "model": body.get("model") or "claude-sonnet-5",
            "system_prompt": str(body.get("system_prompt") or "").strip(),
        }
    if mode == "capability":
        caps = body.get("capabilities")
        caps = [c for c in caps if c in CAPABILITIES] if isinstance(caps, list) else []
        profile: dict[str, Any] = {
            "name": sanitize_label(body.get("label")),
            "mode": "capability",
            "adapter": body.get("adapter") or "http",
            "capabilities": caps,
        }
        tools = normalize_tools(body.get("tools"))
        # A named tool inventory binds attacks to real tool names. When it is
        # there, the profile takes the capabilities from it.
        if tools:
            profile["tools"] = tools
        if profile["adapter"] == "http":
            profile["url"] = body.get("url")
        if profile["adapter"] == "command":
            profile["command"] = body.get("command")
        return profile
    return None


def has_anthropic_key(pasted: Any = None) -> bool:
    if isinstance(pasted, str) and pasted.strip():
        return True
    if load_secrets()["anthropic_api_key"]:
        return True
    if hosted():
        # The host never lends its own key to a visitor.
        return False
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def validate(body: dict[str, Any]) -> Optional[str]:
    """Return a message the browser can show, or None when the body is good."""
    mode = body.get("mode")
    if mode not in ("conformance", "capability", "builtin"):
        return "mode must be conformance, capability, or builtin"
    if mode == "conformance" and not str(body.get("system_prompt") or "").strip():
        return "Paste your agent’s instructions before running."
    if mode == "capability":
        adapter = body.get("adapter") or "http"
        if adapter == "http" and not body.get("url"):
            return "Add the HTTP endpoint for your agent."
        if adapter == "command" and not body.get("command"):
            return "Add the shell command for your agent."
        if adapter == "command" and hosted():
            return (
                "The hosted app cannot run a shell command. Use the HTTP "
                "adapter, or run plop on your own machine."
            )
    wants_live = mode in ("conformance", "builtin") and (
        body.get("backend") or "naive"
    ) == "anthropic"
    if wants_live and not has_anthropic_key(body.get("api_key")):
        return (
            "Live API needs an API key. Paste one under Model options, "
            "or use an offline model."
        )
    if normalize_judge(body.get("judge")) == "anthropic" and not has_anthropic_key(
        body.get("api_key")
    ):
        return (
            "The live judge needs an API key. Add one under Model options, "
            "or pick the offline judge."
        )
    return None


def friendly_error(stderr: str, code: int) -> str:
    text = (stderr or "").strip()
    lowered = text.lower()
    if "could not resolve authentication method" in lowered or "anthropic_api_key" in lowered:
        return "Live API needs an API key. Add one under Model options."
    lines = [line for line in text.split("\n") if line.strip()]
    for line in reversed(lines):
        if any(word in line for word in ("Error", "Exception", "TypeError")):
            return line
    return text[-800:] or f"harness exited {code}"


def _child_env(api_key: Optional[str]) -> dict[str, str]:
    """The environment for one run.

    The visitor's key goes in here and nowhere else. On the host, a key in
    the service environment is removed first, so a visitor can never spend
    the owner's budget.
    """
    env = dict(os.environ)
    if hosted():
        env.pop("ANTHROPIC_API_KEY", None)
    else:
        stored = load_secrets()["anthropic_api_key"]
        if stored:
            env["ANTHROPIC_API_KEY"] = stored
    if api_key:
        env["ANTHROPIC_API_KEY"] = api_key
    return env


def _spawn(args: list[str], job: Job) -> tuple[int, str, str]:
    """Run one command and stream its stderr into the job log."""
    proc = subprocess.Popen(
        args,
        cwd=REPO_ROOT,
        env=_child_env(job.api_key),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    stderr_parts: list[str] = []

    def pump() -> None:
        assert proc.stderr is not None
        for line in proc.stderr:
            stderr_parts.append(line)
            job.append_log(line)

    reader = threading.Thread(target=pump, daemon=True)
    reader.start()
    stdout, _ = proc.communicate()
    reader.join(timeout=5)
    return proc.returncode or 0, stdout or "", "".join(stderr_parts)


def _run_side(job: Job, label: str, defended: bool) -> bool:
    """Run one side of the study. Return False when it failed."""
    args = [python_bin(), "-m", "plop.harness", "--label", label]
    if job.profile_path:
        args += ["--profile", str(job.profile_path)]
    else:
        args += ["--adapter", "builtin", "--backend", job.backend or "naive"]
        if job.model:
            args += ["--model", job.model]
    if defended:
        args.append("--defended")
    args += ["--results-dir", str(job.results_dir)]

    job.append_log(
        f"\n› python -m plop.harness --label {label}"
        f"{' --defended' if defended else ''}\n"
    )
    code, stdout, stderr = _spawn(args, job)
    if code != 0:
        job.error = friendly_error(stderr, code)
        return False
    job.append_log(f"ok · {len(stdout)} bytes of summary\n")
    return True


def _run_judge(job: Job, label: str) -> None:
    """Annotate a finished run. The judge is advisory and never fails a job."""
    run_path = job.results_dir / f"run-{label}.json"
    if not run_path.exists():
        job.append_log(f"judge: no run file for {label}, skipped\n")
        return
    job.append_log(
        f"\n› python -m plop.judge --run run-{label}.json --judge {job.judge}\n"
    )
    try:
        _spawn(
            [python_bin(), "-m", "plop.judge", "--run", str(run_path), "--judge", job.judge],
            job,
        )
    except OSError as err:
        job.append_log(f"judge error (advisory, ignored): {err}\n")


def _execute(job: Job) -> None:
    job.status = "running"
    job.started_at = int(time.time() * 1000)
    try:
        job.results_dir.mkdir(parents=True, exist_ok=True)
        sides = (
            [("naive", False), ("defended", True)]
            if job.pair
            else [("defended" if job.defended else "naive", job.defended)]
        )
        for suffix, defended in sides:
            label = f"{job.label}-{suffix}"
            if not _run_side(job, label, defended):
                job.status = "failed"
                return
            if job.judge != "off":
                _run_judge(job, label)
        job.status = "done"
        job.study = job.label
    except Exception as err:  # noqa: BLE001 — the browser gets the message
        job.status = "failed"
        job.error = str(err)
    finally:
        # Never keep the key on the job after the run ends.
        job.api_key = None
        if job.profile_path and job.profile_path.exists():
            job.profile_path.unlink(missing_ok=True)
        job.finished_at = int(time.time() * 1000)


def start_run(body: dict[str, Any], results_dir: Path) -> Job:
    """Make the job, write its profile, and queue it."""
    label = sanitize_label(body.get("label"))
    api_key = body.get("api_key")
    api_key = api_key.strip() if isinstance(api_key, str) and api_key.strip() else None

    job = Job(
        id=str(uuid.uuid4()),
        mode=str(body.get("mode")),
        label=label,
        results_dir=results_dir,
        pair=body.get("pair") is not False,
        defended=bool(body.get("defended")),
        backend=body.get("backend") or "naive",
        model=body.get("model") or "claude-sonnet-5",
        judge=normalize_judge(body.get("judge")),
        api_key=api_key,
    )

    profile = build_profile(body)
    if profile is not None:
        profiles_root().mkdir(parents=True, exist_ok=True)
        path = profiles_root() / f"{label}-{job.id[:8]}.json"
        path.write_text(json.dumps(profile, indent=2), encoding="utf8")
        job.profile_path = path

    with _jobs_lock:
        _jobs[job.id] = job
    _pool.submit(_execute, job)
    return job
