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


def _create_shift(client, manager_headers, name="Day", start="09:00:00", end="17:00:00") -> dict:
    return client.post(
        "/api/shift-templates",
        json={"name": name, "start_time": start, "end_time": end},
        headers=manager_headers,
    ).json()


def _create_agent(client, manager_headers, name, skill_ids, shift_id) -> dict:
    return client.post(
        "/api/agents",
        json={"name": name, "default_shift_id": shift_id, "skill_ids": skill_ids},
        headers=manager_headers,
    ).json()


def _create_coverage(client, manager_headers, day_of_week, skill_id, min_required, start="09:00:00", end="17:00:00") -> dict:
    return client.post(
        "/api/coverage-requirements",
        json={
            "day_of_week": day_of_week,
            "time_slot_start": start,
            "time_slot_end": end,
            "skill_id": skill_id,
            "min_agents_required": min_required,
        },
        headers=manager_headers,
    ).json()


def _create_balance(client, manager_headers, agent_id, days=10) -> dict:
    return client.post(
        "/api/leave-balance",
        json={"agent_id": agent_id, "year": date.today().year, "total_leave_days_allotted": days},
        headers=manager_headers,
    ).json()


def _submit_request(client, headers, week_cycle_id, request_type, start_date, **extra) -> dict:
    payload = {"week_cycle_id": week_cycle_id, "request_type": request_type, "requested_start_date": start_date, **extra}
    return client.post("/api/requests", json=payload, headers=headers).json()


def test_generate_roster_with_no_requests_satisfies_coverage(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    agent = _create_agent(client, manager_headers, "Solo Agent", [skill["id"]], shift["id"])
    _create_coverage(client, manager_headers, day_of_week=0, skill_id=skill["id"], min_required=1)

    response = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["roster"]["status"] == "draft"
    assert body["roster"]["generated_by"] == "solver"
    monday_assignments = [a for a in body["assignments"] if a["date"] == cycle["week_start_date"]]
    assert len(monday_assignments) >= 1
    assert monday_assignments[0]["agent_id"] == agent["id"]


def test_off_day_denied_and_reflected_in_request_status(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    _create_coverage(client, manager_headers, day_of_week=0, skill_id=skill["id"], min_required=1)

    req = _submit_request(client, agent_headers, cycle["id"], "off_day", cycle["week_start_date"])

    response = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    assert response.status_code == 201
    body = response.json()
    assert len(body["conflicts"]) == 1
    assert body["conflicts"][0]["unmet_request_id"] == req["id"]

    updated = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert updated["status"] == "denied"
    assert updated["denial_reason"] == "coverage requirement"


def test_off_day_honored_with_slack(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    second_agent = _create_agent(client, manager_headers, "Backup Agent", [skill["id"]], shift["id"])
    _create_coverage(client, manager_headers, day_of_week=0, skill_id=skill["id"], min_required=1)

    req = _submit_request(client, agent_headers, cycle["id"], "off_day", cycle["week_start_date"])

    response = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    body = response.json()
    assert body["conflicts"] == []

    updated = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert updated["status"] == "approved"

    monday_assignments = [a for a in body["assignments"] if a["date"] == cycle["week_start_date"]]
    assert all(a["agent_id"] != agent_record.id for a in monday_assignments)
    assert any(a["agent_id"] == second_agent["id"] for a in monday_assignments)


def test_leave_honored_decrements_balance(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    _create_balance(client, manager_headers, agent_record.id, days=5)
    # No coverage requirement at all -> nothing forces the agent to work, leave is honored

    _submit_request(client, agent_headers, cycle["id"], "leave_full", cycle["week_start_date"])
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)

    balance = client.get(f"/api/leave-balance/{agent_record.id}", headers=manager_headers).json()
    assert balance["remaining_balance"] == 4
    assert balance["leave_days_taken"] == 1


def test_regeneration_refunds_balance_when_outcome_flips(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    _create_balance(client, manager_headers, agent_record.id, days=5)
    _submit_request(client, agent_headers, cycle["id"], "leave_full", cycle["week_start_date"])

    # First generation: no coverage requirement yet -> leave honored, balance decremented
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    balance = client.get(f"/api/leave-balance/{agent_record.id}", headers=manager_headers).json()
    assert balance["remaining_balance"] == 4

    # Now this agent is the sole coverage for Monday -> regeneration must deny the leave and refund
    _create_coverage(client, manager_headers, day_of_week=0, skill_id=skill["id"], min_required=1)
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)

    balance = client.get(f"/api/leave-balance/{agent_record.id}", headers=manager_headers).json()
    assert balance["remaining_balance"] == 5
    assert balance["leave_days_taken"] == 0


def test_infeasible_coverage_returns_422(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    # No agent has this skill at all, but coverage demands one
    _create_coverage(client, manager_headers, day_of_week=0, skill_id=skill["id"], min_required=1)

    response = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    assert response.status_code == 422


def test_satisfaction_metrics_include_aggregate(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    _create_coverage(client, manager_headers, day_of_week=0, skill_id=skill["id"], min_required=1)
    _submit_request(client, agent_headers, cycle["id"], "off_day", cycle["week_start_date"])

    response = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    body = response.json()
    roster_id = body["roster"]["id"]

    metrics = client.get(f"/api/roster/{roster_id}/satisfaction", headers=manager_headers).json()
    assert any(m["agent_id"] is None for m in metrics)
    assert any(m["agent_id"] == agent_record.id for m in metrics)


def test_agent_cannot_generate_roster(client, agent_headers):
    response = client.post("/api/roster/generate?week_cycle_id=1", headers=agent_headers)
    assert response.status_code == 403
