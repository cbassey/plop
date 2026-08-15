"""Pair run-*.json files into studies for the dashboard (asd-ste100).

A study is one before/after pair: the naive side and the defended side of
the same label. This is the Python copy of the loader the Vite dev server
used before the API became a service.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


def base_name(label: str) -> str:
    """Find the study name inside a run label."""
    if label in {"defended", "naive"}:
        return "builtin-demo"
    for suffix in ("-defended", "-naive"):
        if label.endswith(suffix):
            return label[: -len(suffix)]
    for prefix in ("defended-", "naive-"):
        if label.startswith(prefix):
            return label[len(prefix) :]
    return label


def _slim(run: Any) -> Any:
    """Drop the event log. The list view never reads it, and it is large."""
    if not isinstance(run, dict):
        return run
    return {key: value for key, value in run.items() if key != "events"}


def _read_dir(results_dir: Path, studies: dict[str, dict], owned: bool) -> None:
    if not results_dir.is_dir():
        return
    for path in sorted(results_dir.glob("run-*.json")):
        label = path.name[len("run-") : -len(".json")]
        try:
            data = json.loads(path.read_text(encoding="utf8"))
        except (json.JSONDecodeError, OSError):
            continue
        summary = data.get("summary")
        if not summary:
            continue
        records = [
            {**record, "run": _slim(record.get("run"))}
            for record in data.get("records", [])
        ]
        name = base_name(label)
        slot = "defended" if summary.get("defended") else "naive"
        study = studies.setdefault(
            name, {"name": name, "naive": None, "defended": None, "owned": owned}
        )
        # A study the visitor ran wins over a demo study of the same name,
        # so their own run is the one they can delete.
        study["owned"] = study["owned"] or owned
        study[slot] = {"label": label, "summary": summary, "records": records}


def load_studies(dirs: Iterable[Path]) -> dict[str, list[dict]]:
    """Read every folder in order. Later folders win on a name clash.

    The first folder holds the studies that ship with the repo. The second
    holds the studies this visitor ran.
    """
    studies: dict[str, dict] = {}
    folders = list(dirs)
    for index, folder in enumerate(folders):
        _read_dir(folder, studies, owned=index > 0)
    return {"studies": sorted(studies.values(), key=lambda s: s["name"])}


def delete_study(results_dir: Path, study_name: str) -> dict[str, Any]:
    """Delete every file of one study. Only the visitor's own folder."""
    if not study_name:
        return {"ok": False, "error": "missing study name", "deleted": []}
    if not results_dir.is_dir():
        return {"ok": False, "error": "no results directory", "deleted": []}

    deleted: list[str] = []
    for path in sorted(results_dir.glob("*.json")):
        label = None
        for prefix in ("run-", "summary-"):
            if path.name.startswith(prefix):
                label = path.name[len(prefix) : -len(".json")]
                break
        if label is None or base_name(label) != study_name:
            continue
        path.unlink()
        deleted.append(path.name)

    if not deleted:
        return {
            "ok": False,
            "error": f'no files for study "{study_name}"',
            "deleted": [],
        }
    return {"ok": True, "deleted": deleted}
