from datetime import date, datetime, timedelta, timezone

from app.models.weekly_cycle import WeeklyCycle


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
        "/api/shift-templates",
        json={"name": "Day", "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=manager_headers,
    ).json()


def _create_agent(client, manager_headers, skill_id, shift_id) -> dict:
    return client.post(
        "/api/agents",
        json={"name": "Solo Agent", "default_shift_id": shift_id, "skill_ids": [skill_id]},
        headers=manager_headers,
    ).json()


def _generate_roster(client, manager_headers, cycle, coverage=True):
    skill = _create_skill(client, manager_headers)
    shift = _create_shift(client, manager_headers)
    _create_agent(client, manager_headers, skill["id"], shift["id"])
    if coverage:
        client.post(
            "/api/coverage-requirements",
            json={
                "day_of_week": 0,
                "time_slot_start": "09:00:00",
                "time_slot_end": "17:00:00",
                "skill_id": skill["id"],
                "min_agents_required": 1,
            },
            headers=manager_headers,
        )
    return client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers).json()["roster"]


def test_publish_then_lock_happy_path(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)
    assert roster["status"] == "draft"

    published = client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers).json()
    assert published["status"] == "published"

    cycle_after_publish = client.get("/api/weekly-cycles", headers=manager_headers).json()
    assert next(c for c in cycle_after_publish if c["id"] == cycle["id"])["status"] == "published"

    locked = client.post(f"/api/roster/{roster['id']}/lock", headers=manager_headers).json()
    assert locked["status"] == "locked"

    cycle_after_lock = client.get("/api/weekly-cycles", headers=manager_headers).json()
    assert next(c for c in cycle_after_lock if c["id"] == cycle["id"])["status"] == "locked"


def test_cannot_lock_unpublished_roster(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)

    response = client.post(f"/api/roster/{roster['id']}/lock", headers=manager_headers)
    assert response.status_code == 400


def test_cannot_publish_twice(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)
    client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers)

    response = client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers)
    assert response.status_code == 400


def test_locked_cycle_blocks_regeneration_and_new_requests(client, manager_headers, agent_headers):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)
    client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers)
    client.post(f"/api/roster/{roster['id']}/lock", headers=manager_headers)

    regen = client.post(f"/api/roster/generate?week_cycle_id={cycle['id']}", headers=manager_headers)
    assert regen.status_code == 400

    submit = client.post(
        "/api/requests",
        json={"week_cycle_id": cycle["id"], "request_type": "off_day", "requested_start_date": cycle["week_start_date"]},
        headers=agent_headers,
    )
    assert submit.status_code == 400


def test_auto_lock_locks_due_cycles(client, manager_headers, db_session):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)
    client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers)

    db_cycle = db_session.query(WeeklyCycle).filter(WeeklyCycle.id == cycle["id"]).first()
    db_cycle.lock_timestamp = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    from app.services.roster_lifecycle import auto_lock_due_cycles

    locked_ids = auto_lock_due_cycles(db_session)
    assert cycle["id"] in locked_ids

    updated_cycle = client.get("/api/weekly-cycles", headers=manager_headers).json()
    assert next(c for c in updated_cycle if c["id"] == cycle["id"])["status"] == "locked"

    updated_roster = client.get(f"/api/roster/{roster['id']}/detail", headers=manager_headers).json()
    assert updated_roster["status"] == "locked"


def test_auto_lock_skips_cycles_not_yet_due(client, manager_headers, db_session):
    cycle = _create_cycle(client, manager_headers)

    from app.services.roster_lifecycle import auto_lock_due_cycles

    locked_ids = auto_lock_due_cycles(db_session)
    assert cycle["id"] not in locked_ids


def test_public_endpoints_hide_draft_and_show_published(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)

    # still draft -> not publicly visible
    response = client.get(f"/api/roster/{cycle['week_start_date']}")
    assert response.status_code == 404

    client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers)

    response = client.get(f"/api/roster/{cycle['week_start_date']}")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "published"
    assert body["week_start_date"] == cycle["week_start_date"]
    assert len(body["assignments"]) >= 1
    assert "agent_name" in body["assignments"][0]
    assert "shift_name" in body["assignments"][0]
    assert "skill_name" in body["assignments"][0]


def test_public_roster_requires_no_auth(client, manager_headers):
    cycle = _create_cycle(client, manager_headers)
    roster = _generate_roster(client, manager_headers, cycle)
    client.post(f"/api/roster/{roster['id']}/publish", headers=manager_headers)

    # no Authorization header at all
    response = client.get(f"/api/roster/{cycle['week_start_date']}")
    assert response.status_code == 200
    response = client.get("/api/roster/current")
    assert response.status_code == 200
