"""Default threat patterns for the guard library (asd-ste100).

These are the library defaults. A GuardPolicy can replace any of them with
patterns that fit the host agent's tools and data.
"""

from __future__ import annotations

import re

# A value that looks like a path, an absolute path, an encoded traversal, a
# URL, a known secret file, or a null byte. This is the schema-smuggling risk.
DANGEROUS_INPUT = re.compile(
    r"""
    (\.\./)            |   # path traversal
    (\.\.\\)           |   # windows path traversal
    (\.\.%2f)          |   # encoded traversal: dotdot + encoded slash
    (\.\.%5c)          |   # encoded traversal: dotdot + encoded backslash
    (%2e%2e)           |   # fully encoded dotdot
    (^\s*/)            |   # absolute path
    (^[a-z][a-z0-9+.\-]*://)  |  # a url scheme, for example https://
    (etc/passwd)       |
    (etc/shadow)       |
    (\x00)                 # null byte
    """,
    re.IGNORECASE | re.VERBOSE,
)

# A line inside tool output that tries to give the agent an order. This is the
# indirect-injection payload.
INJECTION_LINE = re.compile(
    r"""
    (system\s*:)                    |
    (ignore\s+all\s+previous)       |
    (ignore\s+previous\s+instruction) |
    (disregard\s+(your|all|previous)) |
    (call\s+write_note)             |
    (use\s+write_note)              |
    (reveal\s+your)                 |
    (maintenance\s+mode)            |
    (do\s+not\s+mention\s+this)     |
    (you\s+are\s+now)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# The marker the sanitizer uses when it withholds bad tool output. The agent
# relays it, so the user learns the data was bad.
TOOL_OUTPUT_ERROR = "TOOL_OUTPUT_ERROR"
