# plop dashboard

Instrument-console UI for the plop adversarial harness. Configure a study,
run guards off then on, and read defense rates, category breakdowns, and
case traces — from the browser.

Vite + React + Tailwind + shadcn/ui. A small local API
(`server/api.mjs`) shells out to `python -m plop.harness`.

## Use

```bash
# From the repo root: install the Python package once.
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"

cd ui
npm install
npm run dev      # API :8787 + UI http://localhost:5173
```

`npm run dev` starts both the Vite app and the harness API. The UI talks to
`/api/*` (proxied to the API).

Offline-only sync of existing result files:

```bash
npm run sync     # read ../results/*.json into src/results.json
```

`npm run build` type-checks and produces a static bundle in `dist/`.

## Views

- **Run** — conformance (paste your system prompt), capability (point at a
  live adapter + declare tool capabilities), or the builtin demo. Starts a
  naive → defended pair and streams status.
- **Results** — study list + Overview / Classes / Cases panes (not one long
  scroll). Sync pulls the latest `results/` files.

## How it reads plop

`scripts/build-results.mjs` reads `../results/run-*.json` and pairs each
`<base>-naive` / `<base>-defended` run into one study. The API rewrites
`src/results.json` after every UI-triggered run; `npm run sync` does the
same from the CLI.

## shadcn

Components live in `src/components/ui` and are owned in-repo (the shadcn
model). `components.json` is set up so `npx shadcn@latest add <component>`
works if you want more.
