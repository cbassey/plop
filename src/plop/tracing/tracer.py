"""Trace logging in JSON Lines format (asd-ste100).

The Tracer writes one JSON object per line. Each object is one event in the
agent run. This format is easy to read, easy to append, and easy to parse
later for scoring.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class TraceEvent:
    """One event in a run.

    Fields:
        seq: The order number of the event in the run.
        kind: The event type. For example "user_prompt", "model_response",
            "tool_call", "tool_result", "guard", or "final".
        data: The event payload. The shape depends on the kind.
        ts: The Unix time when the event was made.
    """

    seq: int
    kind: str
    data: dict[str, Any]
    ts: float = field(default_factory=time.time)


class Tracer:
    """Collect trace events for one agent run and write them as JSON Lines.

    Use one Tracer per run. Call log() for each event. Call write() to save
    the events to a file. Call events() to read the events in memory.
    """

    def __init__(self, run_id: str, case_id: Optional[str] = None) -> None:
        self.run_id = run_id
        self.case_id = case_id
        self._events: list[TraceEvent] = []
        self._seq = 0

    def log(self, kind: str, **data: Any) -> TraceEvent:
        """Add one event to the trace and return it."""
        event = TraceEvent(seq=self._seq, kind=kind, data=data)
        self._events.append(event)
        self._seq += 1
        return event

    def events(self) -> list[TraceEvent]:
        """Return the events in memory."""
        return list(self._events)

    def as_dicts(self) -> list[dict[str, Any]]:
        """Return the events as plain dictionaries."""
        return [asdict(e) for e in self._events]

    def write(self, path: str | Path) -> Path:
        """Write the events to a file in JSON Lines format."""
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as handle:
            for event in self._events:
                handle.write(json.dumps(asdict(event), ensure_ascii=False) + "\n")
        return out
