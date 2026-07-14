from fastapi import FastAPI

from app.api.routes import (
    agents,
    appeals,
    audit,
    auth,
    coverage_requirements,
    leave_balance,
    public_roster,
    roster,
    shift_templates,
    skills,
    solver_config,
    weekly_cycles,
    weekly_requests,
)

app = FastAPI(title="CallRoster Pro API", version="0.1.0")

app.include_router(auth.router)
app.include_router(skills.router)
app.include_router(agents.router)
app.include_router(shift_templates.router)
app.include_router(coverage_requirements.router)
app.include_router(weekly_cycles.router)
app.include_router(leave_balance.router)
app.include_router(weekly_requests.router)
app.include_router(solver_config.router)
app.include_router(roster.router)
app.include_router(public_roster.router)
app.include_router(audit.router)
app.include_router(appeals.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
