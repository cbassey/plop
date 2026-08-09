# ADR 0002: Split the guards into a library and add an adapter seam

> This document uses ASD-STE100 Simplified Technical English.

Date: 2026-08-09. Status: accepted.

## Context

plop started as a closed study: one demo agent, one suite, one report. The
guards lived inside the demo agent (`src/agent/guards.py`) and the runner
could only attack the demo loop. That made the results real but the value
locked in: no other agent could use the guards, and no other agent could be
attacked.

## Decision

1. **`plop.guards` is now a standalone library.** It holds a `GuardPolicy`
   (plain data), pure guard functions, and a `GuardedPipeline` with three
   hooks: `before_tool`, `after_tool`, `final_output`. It imports nothing
   from the demo agent, the tools, or the harness. Any Python agent wraps
   its tool execution with the three hooks. The demo agent now consumes the
   library through `AgentConfig.to_policy()` — it is the first customer, so
   the before/after study also proves the library.

2. **`plop.adapters` is the seam between the harness and any agent.** The
   contract is two JSON shapes: a case payload in, a transcript out (see
   `docs/adapter-contract.md`). Three adapters ship: `BuiltinAdapter` (the
   demo agent), `HttpAdapter` (any web agent, any language), and
   `CommandAdapter` (any runnable agent, any language). The runner and the
   scorer only see transcripts, so they treat every agent the same.

3. **Everything moved under one `plop` package.** Before, the repo installed
   four top-level packages (`agent`, `tools`, `harness`, `tracing`) — rude
   to any environment that installs it. Now there is one: `plop`.

## Consequences

- Another team plugs an agent in by implementing one JSON contract, in any
  language. The quill example (`examples/quill/`) shows this for a
  TypeScript agent.
- Guard fixes land in one place and every consumer gets them.
- The transcript is self-reported by the adapter. For the built-in agent
  the harness observes writes directly; for external agents the score is
  only as honest as the adapter. The contract documents this openly.
- The demo tools keep their special knowledge (for example, record JSON
  validation) in wiring code, not in the library: the library gets a
  generic `json_object_validator`, the demo config applies it to
  `get_record`.
