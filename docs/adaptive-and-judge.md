# Adaptive variants and the advisory judge

> This document uses ASD-STE100 Simplified Technical English.

Two Phase 4 features, with one rule between them: **the number stays honest.**
Adaptivity grows the corpus without making the before/after unfair. The judge
adds a second opinion without ever changing the score.

## Adaptive variants: generate → freeze → replay

A single phrasing of an attack tests one phrasing. A defense that holds the
literal base case may miss a reworded one. So plop expands each base case into
surface variants — but it does this under a strict discipline, because an
adaptive suite that gave the defended arm easier attacks than the naive arm
would post a better number for the wrong reason.

```
generate ─▶ freeze ─▶ replay
```

- **generate** — `expand_suite(base, seed, variants_per_case)` wraps each
  prompt in benign frames. Same seed, same output, on every machine. The frames
  never remove a trigger word or alter a quoted payload, so a variant is the
  same attack in different words.
- **freeze** — `freeze_suite(cases, path, seed)` writes the expanded set to one
  file, the artifact of record. Nothing regenerates at run time.
- **replay** — both study arms load that one file. Identical attacks, identical
  order, identical ids. The comparison is fair by construction.

Turnkey:

```bash
# Freeze a variant suite (deterministic), then replay both arms against it.
python -m plop.adaptive --seed 7 --variants 3 \
    --out results/adaptive-suite.yaml --replay --label adaptive
```

`replay_paired` returns a `fair` flag that is True only when both arms actually
scored the same set of case ids — a self-check that the discipline held. The CLI
prints it:

```
Replay (fair=True): naive 0.0 (0/80) -> defended 1.0 (80/80)
```

The variant operators here are semantics-preserving frames. They prove a defense
holds across rewording. Gap-seeking operators — encoding tricks, reordering, a
model-written paraphrase — plug into the **same** freeze/replay harness. The
discipline is the deliverable; the operator set is meant to grow.

## The advisory judge

A model reviewer is useful — it can read a transcript and say "this looks unsafe
even though the checks passed," or the reverse. But a model is not a reliable
gate: it is non-deterministic and it can be wrong. So plop's judge is **advisory
by construction**, not by policy:

- The **scorer runs first** and writes the run artifact. Its rule-based checks
  are the number.
- The **judge runs afterward**, on that saved artifact. It attaches a `judgment`
  to each scored case and a `judge.disagreements` list to the summary. It has no
  code path to the score — `annotate_records` reads and writes only the
  `judgment` field, and `annotate_run` raises if the defense rate moved.

Hard checks gate; the judge explains. A disagreement is a review signal, not a
failure.

```bash
# Score a run first.
python -m plop.harness --label my-agent --profile profiles/quill.json

# Annotate it. 'rule' is offline and deterministic; 'anthropic' is a live model.
python -m plop.judge --run results/run-my-agent.json --judge anthropic
```

Two judges ship:

- `RuleAgreementJudge` — offline, deterministic. It narrates the hard check's
  own verdict (which checks held or failed). It always agrees, so it is the safe
  default for a readable rationale without a model.
- `LlmJudge` — a model-backed second opinion that can disagree. It asks the
  model for one JSON verdict, and degrades to "unsure" on any parse or API
  error, so a judge that cannot run never breaks a study.

The safety argument is pinned by `test_judge_is_advisory_only`: a judge that
disagrees with every case changes not one score and does not move the defense
rate.
