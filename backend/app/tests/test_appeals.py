from datetime import date, datetime, timedelta, timezone

from app.models.enums import WeeklyCycleStatus
from app.models.weekly_cycle import WeeklyCycle


def _next_monday(weeks_ahead: int = 1) -> date:
    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7 or 7
    return today + timedelta(days=days_until_monday + 7 * (weeks_ahead - 1))


def _create_cycle(client, manager_headers, weeks_ahead: int = 2) -> dict:
    monday = _next_monday(weeks_ahead)
    return client.post(
        "/api/weekly-cycles", json={"week_start_date": monday.isoformat()}, headers=manager_headers
    ).json()


def _open_appeal_window(db_session, cycle_id: int) -> None:
    # Appeals only open once the roster is published — which is also when request
    # outcomes become visible to the agent — so mark the cycle published here.
    now = datetime.now(timezone.utc)
    db_cycle = db_session.query(WeeklyCycle).filter(WeeklyCycle.id == cycle_id).first()
    db_cycle.status = WeeklyCycleStatus.published
    db_cycle.publish_date = now - timedelta(minutes=1)
    db_cycle.appeal_deadline = now + timedelta(days=1)
    db_session.commit()


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


def _setup_denied_off_day(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    _create_coverage(client, manager_headers, 0, skill["id"], 1)  # sole agent -> off-day must be denied
    monday = cycle["week_start_date"]
    req = client.post(
        "/api/requests",
        json={"week_cycle_id": cycle["id"], "request_type": "off_day", "requested_start_date": monday},
        headers=agent_headers,
    ).json()
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    return cycle, skill, shift, req


def test_agent_can_appeal_denied_request_within_window(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])

    response = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "I needed that day for a family event"},
        headers=agent_headers,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "pending"

    updated = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert updated["status"] == "appealed"


def test_appeal_rejected_outside_window(client, manager_headers, agent_headers, agent_record):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    # window not opened -> publish_date is still in the future
    response = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "test"}, headers=agent_headers
    )
    assert response.status_code == 400


def test_appeal_requires_denied_status(client, manager_headers, agent_headers, agent_record, db_session):
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    monday = cycle["week_start_date"]
    req = client.post(
        "/api/requests",
        json={"week_cycle_id": cycle["id"], "request_type": "off_day", "requested_start_date": monday},
        headers=agent_headers,
    ).json()
    _open_appeal_window(db_session, cycle["id"])

    response = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "test"}, headers=agent_headers
    )
    assert response.status_code == 400
    assert "denied" in response.json()["detail"]


def test_appeal_requires_own_request(client, manager_headers, agent_headers, db_session):
    # manager submits on behalf of a *different* agent so agent_headers doesn't own it
    cycle = _create_cycle(client, manager_headers)
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    other_agent = client.post(
        "/api/agents", json={"name": "Other", "default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    ).json()
    _create_coverage(client, manager_headers, 0, skill["id"], 1)
    monday = cycle["week_start_date"]
    req = client.post(
        "/api/requests",
        json={"week_cycle_id": cycle["id"], "agent_id": other_agent["id"], "request_type": "off_day", "requested_start_date": monday},
        headers=manager_headers,
    ).json()
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    _open_appeal_window(db_session, cycle["id"])

    response = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "test"}, headers=agent_headers
    )
    assert response.status_code == 403


def test_duplicate_pending_appeal_rejected(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])
    client.post("/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "first"}, headers=agent_headers)

    response = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "second"}, headers=agent_headers
    )
    assert response.status_code == 400


def test_manager_approves_appeal_reopens_request(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])
    appeal = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "family event"}, headers=agent_headers
    ).json()

    response = client.patch(
        f"/api/appeals/{appeal['id']}",
        json={"status": "approved", "manager_response": "Will review staffing and try to honor this"},
        headers=manager_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"

    updated = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert updated["status"] == "pending"  # reopened for the solver, not directly granted


def test_manager_denies_appeal_keeps_request_denied(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])
    appeal = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "family event"}, headers=agent_headers
    ).json()

    response = client.patch(
        f"/api/appeals/{appeal['id']}",
        json={"status": "denied", "manager_response": "Coverage constraints leave no room this week"},
        headers=manager_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "denied"

    updated = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert updated["status"] == "denied"


def test_review_requires_manager_response(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])
    appeal = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "family event"}, headers=agent_headers
    ).json()

    response = client.patch(f"/api/appeals/{appeal['id']}", json={"status": "approved", "manager_response": ""}, headers=manager_headers)
    assert response.status_code == 422


def test_reopened_request_can_be_honored_on_regeneration(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])
    appeal = client.post(
        "/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "family event"}, headers=agent_headers
    ).json()
    client.patch(
        f"/api/appeals/{appeal['id']}", json={"status": "approved", "manager_response": "Adding backup coverage"},
        headers=manager_headers,
    )

    # Manager hires a second agent with the same skill/shift -> now there's slack to honor it
    client.post(
        "/api/agents", json={"name": "Backup", "default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)

    updated = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert updated["status"] == "approved"


def test_manager_can_list_appeals_and_agent_can_list_own(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, skill, shift, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    _open_appeal_window(db_session, cycle["id"])
    client.post("/api/appeals", json={"weekly_request_id": req["id"], "appeal_reason": "family event"}, headers=agent_headers)

    mgr_list = client.get("/api/appeals", headers=manager_headers).json()
    assert len(mgr_list) == 1

    mine = client.get("/api/appeals/mine", headers=agent_headers).json()
    assert len(mine) == 1

    forbidden = client.get("/api/appeals", headers=agent_headers)
    assert forbidden.status_code == 403
