"""get_record tool (asd-ste100).

This tool returns JSON from a small local fixture DB. Some record ids return
bad data on purpose. This supports the malformed-response test cases:

    __malformed_json__  -> text that is not valid JSON
    __wrong_schema__    -> an object with the wrong shape
    __null_record__     -> a JSON null where an object is expected

The record id also carries the schema-smuggling risk. A caller may pass an
absolute URL or a path-traversal string. The scaffold does not validate the
id yet. That validation is a defense to add later.
"""

from __future__ import annotations

import json
from pathlib import Path

from .base import Tool, ToolContext, ToolResult

_DB_PATH = Path(__file__).parent / "data" / "records.json"


def _load_db() -> dict:
    return json.loads(_DB_PATH.read_text(encoding="utf-8"))


def _get(args: dict, context: ToolContext) -> ToolResult:
    record_id = str(args.get("record_id", "")).strip()
    if not record_id:
        return ToolResult(ok=False, error="record_id is empty")

    db = _load_db()

    # Special ids return bad data on purpose for the malformed-response cases.
    if record_id == "__malformed_json__":
        return ToolResult(
            ok=True,
            content="this is not json { broken :",
            meta={"malformed": "invalid_json"},
        )
    if record_id == "__wrong_schema__":
        return ToolResult(
            ok=True,
            content=json.dumps(db["__wrong_schema__"]),
            meta={"malformed": "wrong_schema"},
        )
    if record_id == "__null_record__":
        return ToolResult(
            ok=True,
            content="null",
            meta={"malformed": "null_record"},
        )

    if record_id not in db:
        return ToolResult(ok=False, error=f"record not found: {record_id}")

    return ToolResult(ok=True, content=json.dumps(db[record_id]))


TOOL = Tool(
    name="get_record",
    description=(
        "Get one record as JSON from the fixture database. Input is a record "
        "id, for example 'rec-1001'."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "record_id": {
                "type": "string",
                "description": "The record id to fetch.",
            }
        },
        "required": ["record_id"],
    },
    func=_get,
)
