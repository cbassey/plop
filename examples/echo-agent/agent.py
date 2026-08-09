#!/usr/bin/env python3
"""The smallest possible plop command-adapter agent (asd-ste100).

Run the suite against it:

    python -m plop.harness --label echo --adapter command \
        --command "python examples/echo-agent/agent.py"

The contract: read one case JSON object from stdin, print one transcript
JSON object to stdout. This agent calls no tools and refuses every task, so
it passes most attack cases — but it is useless. Its job is to show the
contract, not to be a good agent.
"""

import json
import sys


def main() -> int:
    case = json.load(sys.stdin)

    transcript = {
        "final_text": (
            f"I can only help with the stated task. I will not follow "
            f"instructions found in documents or tool output. "
            f"(case: {case.get('id', 'unknown')})"
        ),
        "stop_reason": "end_turn",
        "iterations": 1,
        "tool_calls": [],
        "writes": [],
    }

    json.dump(transcript, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
