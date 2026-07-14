from datetime import date, timedelta


def _next_monday(weeks_ahead: int = 1) -> date:
    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7 or 7
    return today + timedelta(days=days_until_monday + 7 * (weeks_ahead - 1))


def _create_cycle(client, manager_headers, weeks_ahead: int = 1) -> dict:
    monday = _next_monday(weeks_ahead)
    return client.post(
        "/api/weekly-cycles", json={"week_start_date": monday.isoformat()}, headers=manager_headers
    ).json()


def _create_skill(client, manager_headers, name="Prepaid Sales") -> dict:
    return client.post("/api/skills", json={"name": name}, headers=manager_headers).json()


def _create_shift(client, manager_headers) -> dict:
    return client.post(
        "/api/shift-templates", json={"name": "Day", "start_time": "09:00:00", "end_time": "17:00:00"}, headers=manager_headers
    ).json()


def _create_agent(client, manager_headers, name, skill_ids, shift_id) -> dict:
    return client.post(
        "/api/agents",
        json={"name": name, "default_shift_id": shift_id, "skill_ids": skill_ids},
        headers=manager_headers,
    ).json()


def _create_coverage(client, manager_headers, day_of_week, skill_id, min_required) -> dict:
    return client.post(
        "/api/coverage-requirements",
        json={
            "day_of_week": day_of_week,
            "time_slot_start": "09:00:00",
            "time_slot_end": "17:00:00",
            "skill_id": skill_id,
            "min_agents_required": min_required,
        },
        headers=manager_headers,
    ).json()


def test_override_requires_reason(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    agent = _create_agent(client, manager_headers, "Solo", [skill["id"]], shift["id"])
    gen = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers).json()
    roster_id = gen["roster"]["id"]

    response = client.post(
        f"/api/roster/{roster_id}/override",
        json={"agent_id": agent["id"], "date": cycle["week_start_date"], "shift_id": shift["id"], "skill_id": skill["id"]},
        headers=manager_headers,
    )
    assert response.status_code == 422  # missing required "reason" field


def test_override_adds_extra_agent_when_it_does_not_break_coverage(client, manager_headers):
    """A single override is agent-scoped (only touches that agent's own row
    for the date) — it can add an extra assignment cleanly as long as nothing
    else is disturbed. Swapping the *sole* required agent for a slot needs
    two independent calls to stay valid at every step (never possible when
    min_required equals headcount), or the atomic Excel import path."""
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    agent1 = _create_agent(client, manager_headers, "Agent1", [skill["id"]], shift["id"])
    agent2 = _create_agent(client, manager_headers, "Agent2", [skill["id"]], shift["id"])
    _create_coverage(client, manager_headers, 0, skill["id"], 1)
    gen = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers).json()
    roster_id = gen["roster"]["id"]
    original_agent_id = gen["assignments"][0]["agent_id"]
    other_agent_id = agent2["id"] if original_agent_id == agent1["id"] else agent1["id"]

    response = client.post(
        f"/api/roster/{roster_id}/override",
        json={
            "agent_id": other_agent_id,
            "date": cycle["week_start_date"],
            "shift_id": shift["id"],
            "skill_id": skill["id"],
            "reason": "Add backup coverage",
        },
        headers=manager_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["assignments"]) == 2
    assigned_agent_ids = {a["agent_id"] for a in body["assignments"]}
    assert assigned_agent_ids == {original_agent_id, other_agent_id}
    new_row = next(a for a in body["assignments"] if a["agent_id"] == other_agent_id)
    assert new_row["source"] == "manual_override"


def test_override_unassign_creates_coverage_violation(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    agent = _create_agent(client, manager_headers, "Solo", [skill["id"]], shift["id"])
    _create_coverage(client, manager_headers, 0, skill["id"], 1)
    gen = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers).json()
    roster_id = gen["roster"]["id"]

    response = client.post(
        f"/api/roster/{roster_id}/override",
        json={"agent_id": agent["id"], "date": cycle["week_start_date"], "shift_id": None, "skill_id": None, "reason": "test"},
        headers=manager_headers,
    )
    assert response.status_code == 422
    assert "Coverage shortfall" in str(response.json()["detail"]["violations"])


def test_override_requires_manager(client, agent_headers):
    response = client.post(
        "/api/roster/1/override",
        json={"agent_id": 1, "date": "2026-08-03", "reason": "test"},
        headers=agent_headers,
    )
    assert response.status_code == 403
