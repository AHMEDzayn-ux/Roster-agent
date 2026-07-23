from datetime import date, datetime, timedelta, timezone

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


def _create_balance(client, manager_headers, agent_id, days=10):
    year = date.today().year
    return client.post(
        "/api/leave-balance",
        json={"agent_id": agent_id, "year": year, "total_leave_days_allotted": days},
        headers=manager_headers,
    ).json()


def test_agent_submits_off_day_request(client, manager_headers, agent_headers):
    cycle = _create_cycle(client, manager_headers)
    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["request_type"] == "off_day"


def test_leave_full_within_balance_succeeds(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    _create_balance(client, manager_headers, agent_record.id, days=5)

    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_full",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    assert response.status_code == 201


def test_leave_exceeding_balance_rejected(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    _create_balance(client, manager_headers, agent_record.id, days=0.5)

    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_full",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    assert response.status_code == 400
    assert "exceeds remaining leave balance" in response.json()["detail"]


def test_leave_half_requires_portion(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    _create_balance(client, manager_headers, agent_record.id, days=5)

    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_half",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    assert response.status_code == 422


def test_leave_without_balance_configured_rejected(client, manager_headers, agent_headers):
    cycle = _create_cycle(client, manager_headers)
    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_full",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    assert response.status_code == 400
    assert "No leave balance configured" in response.json()["detail"]


def test_manager_submits_on_behalf_requires_agent_id(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=manager_headers,
    )
    assert response.status_code == 400
    assert "agent_id is required" in response.json()["detail"]


def test_manager_submits_on_behalf_of_agent(client, manager_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "agent_id": agent_record.id,
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=manager_headers,
    )
    assert response.status_code == 201
    assert response.json()["agent_id"] == agent_record.id


def test_request_after_deadline_rejected(client, manager_headers, agent_headers, db_session):
    cycle = _create_cycle(client, manager_headers)
    db_cycle = db_session.query(WeeklyCycle).filter(WeeklyCycle.id == cycle["id"]).first()
    db_cycle.request_deadline = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    assert response.status_code == 400
    assert "request window" in response.json()["detail"]


def test_manager_cannot_approve_via_patch(client, manager_headers, agent_headers, agent_record):
    """Pre-solver, PATCH can only deny. Real approval + balance decrement happens
    only via POST /api/roster/generate (the solver decides, per spec §2.6)."""
    cycle = _create_cycle(client, manager_headers)
    _create_balance(client, manager_headers, agent_record.id, days=5)

    create = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_full",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    request_id = create.json()["id"]

    response = client.patch(
        f"/api/requests/{request_id}", json={"status": "approved"}, headers=manager_headers
    )
    assert response.status_code == 422

    balance = client.get(f"/api/leave-balance/{agent_record.id}", headers=manager_headers).json()
    assert balance["remaining_balance"] == 5
    assert balance["leave_days_taken"] == 0


def test_manager_denies_request_requires_reason(client, manager_headers, agent_headers):
    cycle = _create_cycle(client, manager_headers)
    create = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    request_id = create.json()["id"]

    response = client.patch(f"/api/requests/{request_id}", json={"status": "denied"}, headers=manager_headers)
    assert response.status_code == 422

    response = client.patch(
        f"/api/requests/{request_id}",
        json={"status": "denied", "denial_reason": "coverage requirement"},
        headers=manager_headers,
    )
    assert response.status_code == 200
    assert response.json()["denial_reason"] == "coverage requirement"


def test_denied_leave_request_does_not_decrement_balance(client, manager_headers, agent_headers, agent_record):
    cycle = _create_cycle(client, manager_headers)
    _create_balance(client, manager_headers, agent_record.id, days=5)

    create = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_full",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )
    request_id = create.json()["id"]

    client.patch(
        f"/api/requests/{request_id}",
        json={"status": "denied", "denial_reason": "insufficient coverage"},
        headers=manager_headers,
    )

    balance = client.get(f"/api/leave-balance/{agent_record.id}", headers=manager_headers).json()
    assert balance["remaining_balance"] == 5


def test_agent_lists_own_requests(client, manager_headers, agent_headers):
    cycle = _create_cycle(client, manager_headers)
    client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )

    response = client.get("/api/requests/mine", headers=agent_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_manager_lists_requests_for_week(client, manager_headers, agent_headers):
    cycle = _create_cycle(client, manager_headers)
    client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "off_day",
            "requested_start_date": cycle["week_start_date"],
        },
        headers=agent_headers,
    )

    response = client.get(f"/api/requests?week={cycle['id']}", headers=manager_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_leave_multi_day_count_validated_against_balance(client, manager_headers, agent_headers, agent_record):
    """leave_multi spans 3 days (start..end inclusive); submission validates that
    count against the remaining balance without decrementing it (decrement only
    happens when the solver honors the request at generation time)."""
    cycle = _create_cycle(client, manager_headers)
    _create_balance(client, manager_headers, agent_record.id, days=2)
    start = date.fromisoformat(cycle["week_start_date"])
    end = start + timedelta(days=2)

    response = client.post(
        "/api/requests",
        json={
            "week_cycle_id": cycle["id"],
            "request_type": "leave_multi",
            "requested_start_date": start.isoformat(),
            "requested_end_date": end.isoformat(),
        },
        headers=agent_headers,
    )
    assert response.status_code == 400
    assert "exceeds remaining leave balance" in response.json()["detail"]

    balance = client.get(f"/api/leave-balance/{agent_record.id}", headers=manager_headers).json()
    assert balance["remaining_balance"] == 2


# --- outcome visibility + edit window (workflow rules) ---

from app.models.enums import WeeklyCycleStatus  # noqa: E402


def _setup_denied_off_day(client, manager_headers, agent_headers, agent_record):
    """A sole agent requesting an off day the coverage floor needs -> solver denies it."""
    cycle = _create_cycle(client, manager_headers)
    skill = client.post("/api/skills", json={"name": "Support"}, headers=manager_headers).json()
    shift = client.post(
        "/api/shift-templates",
        json={"name": "Day", "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=manager_headers,
    ).json()
    client.patch(
        f"/api/agents/{agent_record.id}",
        json={"default_shift_id": shift["id"], "skill_ids": [skill["id"]]},
        headers=manager_headers,
    )
    client.post(
        "/api/coverage-requirements",
        json={"day_of_week": 0, "time_slot_start": "09:00:00", "time_slot_end": "17:00:00",
              "skill_id": skill["id"], "min_agents_required": 1},
        headers=manager_headers,
    )
    req = client.post(
        "/api/requests",
        json={"week_cycle_id": cycle["id"], "request_type": "off_day", "requested_start_date": cycle["week_start_date"]},
        headers=agent_headers,
    ).json()
    client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    return cycle, req


def test_outcome_hidden_from_agent_until_published(client, manager_headers, agent_headers, agent_record, db_session):
    cycle, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)

    # Draft generation denied it in the DB, but the agent must still see "pending".
    mine = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert mine["status"] == "pending"
    assert mine["denial_reason"] is None
    # The manager, however, sees the real outcome.
    manager_view = client.get(f"/api/requests?week={cycle['id']}", headers=manager_headers).json()[0]
    assert manager_view["status"] == "denied"

    # Once published, the agent sees the real outcome.
    db_cycle = db_session.query(WeeklyCycle).filter(WeeklyCycle.id == cycle["id"]).first()
    db_cycle.status = WeeklyCycleStatus.published
    db_session.commit()
    revealed = client.get("/api/requests/mine", headers=agent_headers).json()[0]
    assert revealed["status"] == "denied"


def test_agent_can_edit_after_draft_generation_before_deadline(client, manager_headers, agent_headers, agent_record):
    _, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)

    # Even though a draft generation denied it, it is still editable before the
    # deadline, and editing returns it to the pending pool.
    resp = client.put(
        f"/api/requests/{req['id']}",
        json={"request_type": "off_day", "requested_start_date": req["requested_start_date"], "reason": "revised"},
        headers=agent_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    assert resp.json()["reason"] == "revised"


def test_edit_blocked_after_request_deadline(client, manager_headers, agent_headers, agent_record, db_session):
    _, req = _setup_denied_off_day(client, manager_headers, agent_headers, agent_record)
    db_cycle = db_session.query(WeeklyCycle).filter(WeeklyCycle.id == req["week_cycle_id"]).first()
    db_cycle.request_deadline = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    resp = client.delete(f"/api/requests/{req['id']}", headers=agent_headers)
    assert resp.status_code == 400
