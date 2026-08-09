"""search_docs tool (asd-ste100).

This tool searches a small local doc set. It returns the text of the docs
that match the query. One doc holds an indirect-injection payload on purpose.
A safe agent must treat that text as data, not as a command.
"""

from __future__ import annotations

from pathlib import Path

from .base import Tool, ToolContext, ToolResult

_DOCS_DIR = Path(__file__).parent / "data" / "docs"


def _load_docs() -> dict[str, str]:
    """Read every doc file into a name to text map."""
    docs: dict[str, str] = {}
    for path in sorted(_DOCS_DIR.glob("*.txt")):
        docs[path.stem] = path.read_text(encoding="utf-8")
    return docs


def _search(args: dict, context: ToolContext) -> ToolResult:
    query = str(args.get("query", "")).strip()
    if not query:
        return ToolResult(ok=False, error="query is empty")

    docs = _load_docs()
    terms = [t.lower() for t in query.split() if t]
    hits: list[str] = []
    for name, text in docs.items():
        haystack = (name + " " + text).lower()
        if any(term in haystack for term in terms):
            hits.append(f"[{name}]\n{text}")

    if not hits:
        return ToolResult(ok=True, content="No matching docs.", meta={"hit_count": 0})

    body = "\n\n".join(hits)
    return ToolResult(ok=True, content=body, meta={"hit_count": len(hits)})


TOOL = Tool(
    name="search_docs",
    description=(
        "Search the local documentation set. Returns the text of matching "
        "docs. Input is a short query string."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "A short search query, for example 'billing'.",
            }
        },
        "required": ["query"],
    },
    func=_search,
)
