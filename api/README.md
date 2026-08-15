# plop API

The service behind the plop dashboard. It runs the same harness the CLI
runs: it starts `python -m plop.harness` as a child process and reports
what that process writes.

> This document uses ASD-STE100 Simplified Technical English: short
> sentences, active voice, and simple words.

## Two modes

| | Local | Hosted (`PLOP_HOSTED=1`) |
| --- | --- | --- |
| Runs go to | `plop/results`, next to the CLI runs | `PLOP_RUNS_DIR/<session>` |
| API key | can stay in `plop/.secrets.json` | never stored, sent per run |
| Command adapter | allowed | refused |
| Sample studies | read and delete | read only |

The host never lends its own key. In hosted mode the service removes
`ANTHROPIC_API_KEY` from the environment of each child process, then adds
back only the key that the visitor sent with that run.

## Run it

```bash
# From the repo root, in the venv you use for plop.
pip install -e ".[anthropic]" && pip install -e "./api[dev]"
uvicorn plop_api.main:app --reload --port 8000
```

The dashboard proxies `/api` to port 8000, so `npm run dev` in `ui/`
finds the service with no more configuration. `npm run api` starts it for
you.

## Routes

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | Liveness, the interpreter, and the mode |
| GET | `/api/capabilities` | The capability kinds a profile can declare |
| GET | `/api/secrets` | Whether a key is stored, and where it can be |
| PUT | `/api/secrets` | Store a key. Local only |
| DELETE | `/api/secrets/anthropic` | Remove the stored key. Local only |
| GET | `/api/results` | The studies this visitor may see |
| POST | `/api/runs` | Start a study. Returns the job |
| GET | `/api/jobs/{id}` | Poll the job: status, log, error |
| DELETE | `/api/studies/{name}` | Delete one of the visitor's studies |

Every failure returns `{"error": "..."}` with the status code.

## Sessions

The browser sends `X-Plop-Session`, a random id it keeps in
`localStorage`. It separates one visitor's runs from another's. **It is
not a login and it protects nothing.** Anybody who copies the id sees the
runs under it. Add real accounts before you put private prompts in a
hosted deployment.

## What a restart loses

Jobs live in memory. A restart of the service loses the jobs that were
running, and the browser sees the poll fail. The result files that a
finished run wrote stay on disk, and on a host that disk is temporary.

## Tests

```bash
python -m pytest api/tests    # from the repo root
```

The run test uses the offline `naive` backend, so it needs no key and no
network.
