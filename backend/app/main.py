from fastapi import FastAPI

from app.api.routes import agents, auth, coverage_requirements, shift_templates, skills

app = FastAPI(title="CallRoster Pro API", version="0.1.0")

app.include_router(auth.router)
app.include_router(skills.router)
app.include_router(agents.router)
app.include_router(shift_templates.router)
app.include_router(coverage_requirements.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
