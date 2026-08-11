# plop dashboard

Local UI for the plop adversarial harness. Same runner as the CLI
(`python -m plop.harness`).

**What plop does:** attacks a tool-using agent (injection, jailbreak, bad
tool data, loops, scope escape, schema smuggling) and scores held vs broke —
open, then defended. Mental model: `../docs/WHAT-PLOP-IS.md`.

## Use

```bash
# From the repo root: install the Python package once.
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"

cd ui
npm install
npm run sync     # optional: refresh src/results.json from ../results
npm run dev      # http://localhost:5173  (API + UI)
```

### Paths in the UI

| UI | Mode | What you bring |
| --- | --- | --- |
| Score my prompt | Conformance | System prompt (+ model) |
| Try the demo | Builtin | Nothing (offline sample agent) |
| Score a live agent | Capability | Running agent adapter + tool kinds |

### Views

- **Runs** — open vs defended rates + glossary
- **Score my prompt** — primary happy path
- **Results** — Score / Attack types / Attacks

Live API keys can be saved on this machine in `../.secrets.json` (gitignored).

`npm run build` type-checks and produces `dist/`. The harness API is only
available under `npm run dev`.
