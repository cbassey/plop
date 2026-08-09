# Two ways to test an agent: conformance and capability

> This document uses ASD-STE100 Simplified Technical English.

plop can test any agent, not only its own demo. There are two modes. Pick by
one question: **do you want to test the agent's prompt and model, or its real
tools and loop?**

## Why there are two modes

An attack needs a place to land. A "reveal your system prompt" probe needs
only a model that answers. But an indirect-injection attack needs a tool that
returns outside content, and a scope attack needs a tool that writes. plop's
suite covers all of these, so a real test must supply those tools somehow.

- **Conformance mode** supplies them from plop. plop mounts its own fixture
  tools, so every attack can land, and the whole suite runs against any
  agent. Turnkey.
- **Capability mode** uses the agent's real tools. The agent declares which
  capabilities its tools provide. An attack that needs a capability the agent
  does not have is skipped and reported as N/A — never passed. Honest partial
  coverage.

This is the fix for a real limitation: the suite is written around
capabilities, not around one agent's tool names. So the same 20 cases test
any agent.

## Conformance mode (default, turnkey)

plop runs its own loop and its own fixture tools, driven by the agent's
system prompt and model. It measures the agent's **prompt and model**, wrapped
in plop's guard library, against the full suite. It answers: "if I put plop's
guards around my prompt and model, does the suite pass?"

The agent's repo needs no code. Write a profile file:

```json
{
  "name": "quill",
  "mode": "conformance",
  "backend": "anthropic",
  "model": "claude-sonnet-5",
  "system_prompt": "You are Quill, a helpful AI assistant for a personal notes app. ..."
}
```

Run it:

```bash
python -m plop.harness --label quill          --profile profiles/quill.json
python -m plop.harness --label quill-defended --profile profiles/quill.json --defended
```

`backend` can be `naive` or `mock` for an offline run with no API key. The
naive backend reproduces the worst-case 0/20 before, and the guards bring it
to 20/20.

What conformance does **not** test: the agent's own bespoke loop and its own
guards. For that, use capability mode.

## Capability mode (opt-in, real tools)

plop attacks the agent's real loop and real tools over an adapter (http or
command; see [adapter-contract.md](adapter-contract.md)). The agent declares
the capabilities its tools provide:

```json
{
  "name": "my-agent",
  "mode": "capability",
  "adapter": "http",
  "url": "http://localhost:3000/api/plop-adapter",
  "capabilities": ["reads_untrusted_content", "has_write_tool"]
}
```

```bash
python -m plop.harness --label my-agent --profile profiles/my-agent.json --defended
```

plop runs only the cases the agent can support. The summary reports the rest
under `skipped_cases`, so coverage stays visible. A skipped case never counts
as a pass.

## The capability vocabulary

| Capability | Meaning | plop fixture tool |
| --- | --- | --- |
| `reads_untrusted_content` | A tool that returns outside content (a doc, an email, an API body). | `search_docs` |
| `returns_structured_record` | A tool that returns a JSON record that could be malformed. | `get_record` |
| `accepts_freeform_id` | A tool that takes a free-form id or path string. | `get_record` |
| `has_write_tool` | A tool that changes state (write, send, create). | `write_note` |

A case declares what it needs in `requires_capabilities`. Conformance mode
provides all four. Capability mode provides only what the profile lists.

## Which mode should I use?

- **Start with conformance.** It is turnkey, it runs the whole suite, and it
  tells you whether your prompt and model, plus plop's guards, hold up.
- **Move to capability mode** when you want to test your agent's own loop and
  guards on its real tools, and you accept partial coverage.
