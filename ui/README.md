# plop dashboard

UI for the plop adversarial harness. Same runner as the CLI
(`python -m plop.harness`), through the API service in `../api`.

**What plop does:** attacks a tool-using agent (injection, jailbreak, bad
tool data, loops, scope escape, schema smuggling) and scores held vs broke —
open, then defended. Mental model: `../docs/WHAT-PLOP-IS.md`.

## Use

The dashboard needs two processes: this app, and the API service that
runs the suite.

```bash
# From the repo root: install the Python packages once.
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]" && pip install -e "./api[dev]"

cd ui
npm install
npm run sync     # optional: refresh src/results.json from ../results

npm run api      # terminal 1 — the API on port 8000
npm run dev      # terminal 2 — http://localhost:5173
```

`npm run dev:all` starts both in one terminal.

Vite sends `/api` to port 8000, so nothing else needs configuration. Point
it somewhere else with `PLOP_API_TARGET`.

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

Live API keys can be saved on this machine in `../.secrets.json`
(gitignored). A hosted deployment saves nothing: it takes a key with each
run and drops it when the run ends.

## Build and deploy

`npm run build` type-checks and produces `dist/`, a static site. Vercel
serves it with the settings in `vercel.json`.

Set one variable on Vercel:

```
VITE_PLOP_API_URL=https://<the Render service>.onrender.com
```

Leave it empty for local work. See `.env.example`, and `../api/README.md`
for the service.
