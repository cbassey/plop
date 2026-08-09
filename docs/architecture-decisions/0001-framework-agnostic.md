# ADR 0001: Hand-roll the agent loop (asd-ste100)

- Status: Accepted
- Date: 2026-08-08

## Context

plop is a red-team harness for agent tool-use. The core of the project is the
agent loop: the code that sends a prompt to a model, runs the tools the model
asks for, and feeds the results back. The study measures how well this loop
defends against adversarial input.

We had to choose between two options:

1. Use an agent framework, for example LangGraph.
2. Hand-roll the loop with plain Python.

## Decision

We hand-roll the loop. We do not use LangGraph or any agent framework.

## Reasons

1. **The mechanism is the product.** This is a security study, not a feature
   app. The value is in the failure modes we find and fix. A reader must see
   the exact point where tool output enters the model context, where a tool
   call is dispatched, and where a guard runs. A hand-rolled loop puts all of
   that in about 150 lines of readable code.

2. **We must control the trust boundary.** The attacks target the seam between
   model output, tool output, and the next model turn. We need to place guards
   at that seam and trace every event. A framework hides this seam behind its
   own abstractions. That makes the guard points harder to see and to explain.

3. **Explainability in an interview.** This is a portfolio project. A reviewer
   can ask "where does the indirect injection enter, and what stops it?" With a
   hand-rolled loop, the answer is a specific function. With a framework, the
   answer is often "the framework handles it", which is not a good answer for a
   security review.

4. **Fewer moving parts.** A framework adds versions, defaults, and behavior we
   did not write. For a small, well-scoped harness, that is more risk than
   help. The only real dependency is the model SDK.

## Where a framework would earn its place

A framework is a good choice when the loop itself is not the point:

- **Complex graphs.** Many nodes, branches, retries, and human-in-the-loop
  steps. A framework gives a clear graph model and state handling.
- **Long-running or resumable runs.** Built-in checkpointing and persistence.
- **A team that must move fast** on product features, where the standard loop
  is fine and the value is elsewhere.
- **Many tools and sub-agents** that need routing and shared state.

For plop, none of these apply. The loop is small, the trust boundary is the
point, and clarity beats convenience.

## Consequences

- We own the loop, the dispatch, and the guard hooks. We also own their bugs.
- The tracing format is ours. It is plain JSON Lines, which is easy to read.
- Porting to a framework later is possible. The tools and the scorer do not
  depend on the loop internals.
