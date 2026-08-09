# plop dashboard

A results viewer for the plop adversarial harness. Vite + React + Tailwind +
shadcn/ui, in an instrument-console theme (dark, phosphor accent, monospace
data). It shows each study's defense rate with guards off, then on, a
per-attack-class breakdown, and the full trace for every case.

## Use

```bash
cd ui
npm install
npm run sync     # read ../results/*.json into src/results.json
npm run dev      # http://localhost:5173
```

Run `npm run sync` again after any new `python -m plop.harness ...` run to
refresh the data. `npm run build` type-checks and produces a static bundle in
`dist/`.

## How it reads plop

`scripts/sync-results.mjs` reads `../results/run-*.json` and pairs each
`<base>-naive` / `<base>-defended` run into one study (so `naive`/`defended`
become the `builtin-demo` study, `quill-naive`/`quill-defended` become
`quill`, and so on). The dashboard renders `src/results.json`.

## shadcn

Components live in `src/components/ui` and are owned in-repo (the shadcn
model). `components.json` is set up so `npx shadcn@latest add <component>`
works if you want more.
