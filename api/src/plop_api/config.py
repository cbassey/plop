"""Settings for the plop API (asd-ste100).

The same service runs in two places:

* On your machine, next to the repo. It writes runs to plop/results, and it
  can keep an API key in plop/.secrets.json. The CLI sees the same files.
* On a host, in front of the public web app. Each visitor gets a folder of
  their own, and the service never writes a key to disk.

`PLOP_HOSTED=1` picks the second one.
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
from pathlib import Path

# api/src/plop_api/config.py -> api/src/plop_api -> api/src -> api -> repo root
REPO_ROOT = Path(__file__).resolve().parents[3]


def hosted() -> bool:
    """True when the service runs in front of the public web app."""
    return os.environ.get("PLOP_HOSTED", "").strip().lower() in {"1", "true", "yes"}


def python_bin() -> str:
    """The interpreter that runs the harness."""
    venv = REPO_ROOT / ".venv" / "bin" / "python"
    if venv.exists():
        return str(venv)
    return os.environ.get("PLOP_PYTHON") or sys.executable


def demo_results_dir() -> Path:
    """The studies that ship with the repo. Everybody can read them."""
    return Path(os.environ.get("PLOP_RESULTS_DIR") or REPO_ROOT / "results")


def runs_root() -> Path:
    """The parent folder for the per-visitor run folders."""
    default = Path(tempfile.gettempdir()) / "plop-runs"
    return Path(os.environ.get("PLOP_RUNS_DIR") or default)


def profiles_root() -> Path:
    """Where a run writes the profile file it gives the harness."""
    return runs_root() / ".profiles"


_SAFE = re.compile(r"[^a-z0-9-]+")


def session_key(raw: str | None) -> str:
    """Clean the session id the browser sends.

    The id only separates one visitor's runs from another's. It is not a
    login, and it grants nothing.
    """
    cleaned = _SAFE.sub("", str(raw or "").lower())[:64]
    return cleaned or "anon"


def session_results_dir(raw_session: str | None) -> Path:
    """Where this visitor's runs go.

    On your machine this is plop/results, so a run from the web app and a
    run from the CLI land in the same place, as they do today.
    """
    if not hosted():
        return demo_results_dir()
    return runs_root() / session_key(raw_session)


def allowed_origins() -> list[str]:
    """Local dev origins always work. Add deployed ones with ALLOWED_ORIGINS."""
    extra = [
        origin.strip()
        for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return ["http://localhost:5173", "http://localhost:4173", *extra]


def max_concurrent_runs() -> int:
    """How many suites run at once. A small host holds a small number."""
    try:
        return max(1, int(os.environ.get("PLOP_MAX_CONCURRENT_RUNS", "2")))
    except ValueError:
        return 2
