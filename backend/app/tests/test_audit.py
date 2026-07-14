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


def _override_producing_audit_entry(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    second_agent = client.post(
        "/api/agents", json={"name": "Backup", "default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    ).json()
    _create_coverage(client, manager_headers, 0, skill["id"], 1)
    monday = cycle["week_start_date"]
    req = client.post(
        "/api/requests",
        json={"week_cycle_id": cycle["id"], "request_type": "off_day", "requested_start_date": monday},
        headers=agent_headers,
    ).json()
    gen = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers).json()
    roster_id = gen["roster"]["id"]

    # Override: force the requester to work anyway (reverses the honored off-day) -> needs reason -> logs audit entries
    client.post(
        f"/api/roster/{roster_id}/override",
        json={"agent_id": agent_record.id, "date": monday, "shift_id": shift["id"], "skill_id": skill["id"], "reason": "Emergency"},
        headers=manager_headers,
    )
    return req


def test_manager_sees_full_audit_log(client, manager_headers, agent_headers, agent_record):
    _override_producing_audit_entry(client, manager_headers, agent_headers, agent_record)

    response = client.get("/api/audit", headers=manager_headers)
    assert response.status_code == 200
    body = response.json()
    action_types = {e["action_type"] for e in body}
    assert "roster_manual_override" in action_types
    assert "request_outcome_overridden" in action_types


def test_audit_log_filterable_by_target_type(client, manager_headers, agent_headers, agent_record):
    _override_producing_audit_entry(client, manager_headers, agent_headers, agent_record)

    response = client.get("/api/audit?target_type=weekly_request", headers=manager_headers)
    assert response.status_code == 200
    body = response.json()
    assert all(e["target_type"] == "weekly_request" for e in body)
    assert len(body) >= 1


def test_agent_sees_only_own_relevant_entries(client, manager_headers, agent_headers, agent_record):
    req = _override_producing_audit_entry(client, manager_headers, agent_headers, agent_record)

    response = client.get("/api/audit/mine", headers=agent_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 1
    assert all(e["target_type"] == "weekly_request" and e["target_id"] == req["id"] for e in body)


def test_agent_cannot_see_full_audit_log(client, agent_headers):
    response = client.get("/api/audit", headers=agent_headers)
    assert response.status_code == 403


def test_unauthenticated_blocked(client):
    response = client.get("/api/audit/mine")
    assert response.status_code == 401
