"""The hand-rolled agent loop (asd-ste100).

This loop is on purpose small and visible. It does not use an agent framework.
The steps are:

    1. Send the system prompt, the messages, and the tool specs to the model.
    2. If the model asks for tools, run each tool and add the results.
    3. Repeat until the model gives a final answer or the loop hits the cap.

Every step writes a trace event. The harness reads the trace to score the run.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from tools import ToolContext, registry

from .backends import ModelBackend, ModelResponse
from .config import AgentConfig
from .dispatch import dispatch
from .guards import iteration_cap, validate_input


@dataclass
class AgentRun:
    """The result of one agent run.

    Fields:
        final_text: The last assistant text.
        stop_reason: Why the loop stopped ("end_turn", "max_iterations").
        iterations: How many model turns the loop used.
        tool_calls: The list of tool calls made, in order.
        writes: The notes written during the run.
        events: The trace events as dicts.
    """

    final_text: str
    stop_reason: str
    iterations: int
    tool_calls: list[dict[str, Any]]
    writes: list[dict[str, Any]]
    events: list[dict[str, Any]]


def run_agent(
    prompt: str,
    backend: ModelBackend,
    config: AgentConfig,
    tracer,
) -> AgentRun:
    """Run the agent loop for one prompt and return the result."""
    tools = registry(config.allowed_tools)
    tool_specs = [t.spec() for t in tools.values()]
    context = ToolContext(task_mode=config.task_mode)

    tracer.log("user_prompt", prompt=prompt, task_mode=config.task_mode)

    # Guard: validate the user input (stub for now).
    checked = validate_input(prompt, config)
    if not checked.allowed:
        tracer.log("guard", stage="input_validation", allowed=False, reason=checked.reason)
        return AgentRun(
            final_text=f"Blocked: {checked.reason}",
            stop_reason="blocked_input",
            iterations=0,
            tool_calls=[],
            writes=[],
            events=tracer.as_dicts(),
        )

    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
    tool_calls_made: list[dict[str, Any]] = []
    cap = iteration_cap(config)

    final_text = ""
    stop_reason = "max_iterations"
    iterations = 0

    for turn in range(cap):
        iterations = turn + 1
        response: ModelResponse = backend.complete(
            config.system_prompt, messages, tool_specs
        )
        tracer.log(
            "model_response",
            turn=turn,
            text=response.text,
            tool_calls=[{"name": c.name, "input": c.input} for c in response.tool_calls],
            stop_reason=response.stop_reason,
        )

        # No tool calls means the model gave a final answer.
        if not response.tool_calls:
            final_text = response.text
            stop_reason = "end_turn"
            break

        # Keep the assistant turn in the history.
        messages.append(_assistant_message(response))

        # Run each tool call and collect the tool results.
        tool_result_blocks: list[dict[str, Any]] = []
        for call in response.tool_calls:
            tracer.log("tool_call", turn=turn, name=call.name, input=call.input)
            result = dispatch(call, tools, context, config)
            tracer.log(
                "tool_result",
                turn=turn,
                name=call.name,
                is_error=result.is_error,
                blocked=result.blocked,
                content=result.content,
                trace=result.trace,
            )
            tool_calls_made.append(
                {
                    "name": call.name,
                    "input": call.input,
                    "blocked": result.blocked,
                    "is_error": result.is_error,
                }
            )
            tool_result_blocks.append(
                {
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": result.content,
                    "is_error": result.is_error,
                }
            )

        messages.append({"role": "user", "content": tool_result_blocks})
    else:
        # The loop ran out of turns.
        tracer.log("final", stop_reason="max_iterations", iterations=iterations)

    if stop_reason == "end_turn":
        tracer.log("final", stop_reason="end_turn", iterations=iterations, text=final_text)

    return AgentRun(
        final_text=final_text,
        stop_reason=stop_reason,
        iterations=iterations,
        tool_calls=tool_calls_made,
        writes=list(context.write_sink),
        events=tracer.as_dicts(),
    )


def _assistant_message(response: ModelResponse) -> dict[str, Any]:
    """Build the assistant message to keep in the history.

    If the backend gave native content blocks, use them. Otherwise, rebuild
    the blocks from the normalized response. This keeps the MockBackend and
    the AnthropicBackend both working.
    """
    if response.raw_content is not None:
        return {"role": "assistant", "content": response.raw_content}

    blocks: list[dict[str, Any]] = []
    if response.text:
        blocks.append({"type": "text", "text": response.text})
    for call in response.tool_calls:
        blocks.append(
            {
                "type": "tool_use",
                "id": call.id,
                "name": call.name,
                "input": call.input,
            }
        )
    return {"role": "assistant", "content": blocks}
