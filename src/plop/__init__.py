"""plop — adversarial eval harness and guard library for tool-use agents.

The package has two faces:

    plop.guards    - a framework-agnostic guard library. Import it into any
                     Python agent to wrap tool calls with defenses.
    plop.adapters  - the seam that lets the harness attack any agent, in any
                     language, over a small JSON contract.

The rest (plop.agent, plop.tools, plop.harness, plop.tracing) is the built-in
study: a small demo agent, three test tools, the runner, and the scorer.
"""

__version__ = "0.2.0"
