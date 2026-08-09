# Example: attack the quill agent (smart-notes)

> This document uses ASD-STE100 Simplified Technical English.

This folder shows how to point the plop suite at a real agent in another
language. The target here is quill, the TypeScript agent in the smart-notes
repo. The same steps work for any agent — quill is only the example.

## The idea

plop does not import your agent. It talks to it over a small JSON contract
(see [docs/adapter-contract.md](../../docs/adapter-contract.md)):

1. plop POSTs one attack case as JSON.
2. Your endpoint runs your real agent on that case.
3. Your endpoint returns a transcript as JSON: the final text, the tool
   calls, and the writes.
4. plop scores the transcript and reports the defense rate.

## Steps for quill

1. Copy `route.ts` into smart-notes as `app/api/plop-adapter/route.ts`.
2. Read the file and adapt the marked parts. It reuses quill's real system
   prompt (`getPromptForTrigger`), real tools (`getToolsForTrigger`), and
   real tool executor (`executeAgentTool`), so the attack hits the real
   surface.
3. Start smart-notes: `npm run dev`.
4. From the plop repo, run:

   ```bash
   python -m plop.harness --label quill-naive --adapter http \
       --url http://localhost:3000/api/plop-adapter
   python -m plop.harness --label quill-defended --defended --adapter http \
       --url http://localhost:3000/api/plop-adapter
   ```

5. Read `results/summary-quill-*.json` for the defense rates, and
   `results/run-quill-*.json` for the full trace of each case.

## Notes

- The route refuses to run in production. An attack endpoint must never
  ship.
- The `defended` flag in the payload is yours to interpret. The example
  shows the simplest guard: on a read-only case, do not offer
  state-changing tools. Port more guards from `plop.guards` as you need
  them — the logic is small and language-neutral by design.
- Some plop cases name plop's demo tools (for example `get_record`). Those
  cases still run, but the sharpest results come from a suite written for
  your agent's own tools. Copy `prompts/adversarial.yaml` and adapt the
  cases; pass the copy with `suite_path` or keep it in your repo.
