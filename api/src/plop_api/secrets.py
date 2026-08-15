"""The API key store (asd-ste100).

On your machine the key can stay in plop/.secrets.json, which is
gitignored. The harness and the CLI read the same file.

On the host there is no store. Each visitor sends their own key with each
run, the run holds it in memory, and the service forgets it when the run
ends. Nothing writes it to disk, and nothing logs it.
"""

from __future__ import annotations

import json
from pathlib import Path

from plop_api.config import REPO_ROOT, hosted

SECRETS_PATH = REPO_ROOT / ".secrets.json"


def _empty() -> dict[str, str | None]:
    return {"anthropic_api_key": None}


def load_secrets() -> dict[str, str | None]:
    if hosted() or not SECRETS_PATH.exists():
        return _empty()
    try:
        data = json.loads(SECRETS_PATH.read_text(encoding="utf8"))
    except (json.JSONDecodeError, OSError):
        return _empty()
    key = data.get("anthropic_api_key") if isinstance(data, dict) else None
    return {"anthropic_api_key": key.strip() if isinstance(key, str) and key.strip() else None}


def save_secrets(anthropic_api_key: str) -> dict[str, str | None]:
    """Write the key with owner-only permissions. Local mode only."""
    if hosted():
        raise PermissionError("the hosted service does not store API keys")
    merged = {"anthropic_api_key": anthropic_api_key.strip() or None}
    SECRETS_PATH.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf8")
    SECRETS_PATH.chmod(0o600)
    return merged


def clear_secret() -> dict[str, str | None]:
    if hosted():
        raise PermissionError("the hosted service does not store API keys")
    if SECRETS_PATH.exists():
        SECRETS_PATH.unlink()
    return _empty()


def mask(value: str | None) -> str | None:
    """Mask like Vercel: a short prefix, then the last four characters."""
    text = (value or "").strip()
    if not text:
        return None
    if len(text) <= 8:
        return "••••••••"
    return f"{text[: min(7, len(text) - 4)]}…{text[-4:]}"


def public_secrets() -> dict[str, object]:
    """What the browser may see. Never the key itself."""
    key = load_secrets()["anthropic_api_key"]
    return {
        "anthropic": {"configured": bool(key), "hint": mask(key)},
        # The browser reads this to decide whether to offer "save this key".
        "storage": "none" if hosted() else "file",
    }
