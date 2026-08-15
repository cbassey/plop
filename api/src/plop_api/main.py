"""The plop API (asd-ste100).

It gives the dashboard what the Vite dev server used to give it, but as a
service you can deploy. The routes keep the paths and the shapes the
browser already uses.

Local:   uvicorn plop_api.main:app --reload --port 8000
Hosted:  PLOP_HOSTED=1 uvicorn plop_api.main:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Body, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from plop_api import jobs as jobs_module
from plop_api import results as results_module
from plop_api import secrets as secrets_module
from plop_api.config import (
    allowed_origins,
    demo_results_dir,
    hosted,
    python_bin,
    session_results_dir,
)

app = FastAPI(title="Plop API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_HEADER = "x-plop-session"


# The browser reads `error` on every failure. FastAPI says `detail`, so
# translate it here and keep one shape on the wire.
@app.exception_handler(HTTPException)
def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
def bad_body(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "invalid JSON body"})


def _results_dirs(session: Optional[str]) -> list:
    """The demo studies first, then the studies this visitor ran."""
    own = session_results_dir(session)
    demo = demo_results_dir()
    return [demo] if own == demo else [demo, own]


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "python": python_bin(),
        "hosted": hosted(),
        "anthropicKey": jobs_module.has_anthropic_key(),
    }


@app.get("/api/capabilities")
def capabilities() -> dict[str, Any]:
    return {"capabilities": jobs_module.CAPABILITIES}


@app.get("/api/secrets")
def get_secrets() -> dict[str, Any]:
    return secrets_module.public_secrets()


@app.put("/api/secrets")
def put_secrets(body: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    key = body.get("anthropic_api_key")
    key = key.strip() if isinstance(key, str) else ""
    if not key:
        raise HTTPException(status_code=400, detail="Paste an API key to save.")
    try:
        secrets_module.save_secrets(key)
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail=(
                "This app never stores your API key. Paste it with each run "
                "instead — it is used for that run and then dropped."
            ),
        ) from None
    return secrets_module.public_secrets()


@app.delete("/api/secrets/anthropic")
def delete_secret() -> dict[str, Any]:
    try:
        secrets_module.clear_secret()
    except PermissionError:
        raise HTTPException(
            status_code=403, detail="This app stores no API key to remove."
        ) from None
    return secrets_module.public_secrets()


@app.get("/api/results")
def get_results(x_plop_session: Optional[str] = Header(default=None)) -> dict[str, Any]:
    return results_module.load_studies(_results_dirs(x_plop_session))


@app.post("/api/runs", status_code=202)
def post_run(
    body: dict[str, Any] = Body(default={}),
    x_plop_session: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    message = jobs_module.validate(body)
    if message:
        raise HTTPException(status_code=400, detail=message)

    pasted = body.get("api_key")
    pasted = pasted.strip() if isinstance(pasted, str) and pasted.strip() else None
    # Only the local service can keep a key, and only when asked to.
    if pasted and not hosted() and body.get("save_api_key") is not False:
        secrets_module.save_secrets(pasted)

    job = jobs_module.start_run(body, session_results_dir(x_plop_session))
    return job.public()


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    job = jobs_module.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.public()


@app.delete("/api/studies/{name}")
def delete_study(
    name: str, x_plop_session: Optional[str] = Header(default=None)
) -> dict[str, Any]:
    own = session_results_dir(x_plop_session)
    result = results_module.delete_study(own, name)
    if not result["ok"]:
        # A label can name its side either way round (run-quill-naive.json,
        # run-naive-live.json), so ask the loader instead of the file name.
        demo_names = {
            study["name"]
            for study in results_module.load_studies([demo_results_dir()])["studies"]
        }
        if own != demo_results_dir() and name in demo_names:
            raise HTTPException(
                status_code=403,
                detail="This is a sample study. It stays for everybody.",
            )
        raise HTTPException(status_code=404, detail=result["error"])
    return {
        "ok": True,
        "deleted": result["deleted"],
        "studies": results_module.load_studies(_results_dirs(x_plop_session))["studies"],
    }
