from datetime import date, datetime, time, timedelta, timezone


def _next_monday(weeks_ahead: int = 1) -> date:
    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7 or 7
    return today + timedelta(days=days_until_monday + 7 * (weeks_ahead - 1))


def _utc_at(d: date, days_offset: int, t: time) -> datetime:
    return datetime.combine(d + timedelta(days=days_offset), t, tzinfo=timezone.utc)


def test_create_weekly_cycle_computes_timeline(client, manager_headers):
    monday = _next_monday()
    response = client.post(
        "/api/weekly-cycles", json={"week_start_date": monday.isoformat()}, headers=manager_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "open"
    assert datetime.fromisoformat(body["request_deadline"]) == _utc_at(monday, 3, time(23, 59, 59))
    assert datetime.fromisoformat(body["publish_date"]) == _utc_at(monday, 4, time(0, 0, 0))
    assert datetime.fromisoformat(body["appeal_deadline"]) == _utc_at(monday, 4, time(23, 59, 59))
    assert datetime.fromisoformat(body["lock_timestamp"]) == _utc_at(monday, 5, time(0, 0, 0))


def test_create_weekly_cycle_rejects_non_monday(client, manager_headers):
    tuesday = _next_monday() + timedelta(days=1)
    response = client.post(
        "/api/weekly-cycles", json={"week_start_date": tuesday.isoformat()}, headers=manager_headers
    )
    assert response.status_code == 400


def test_create_weekly_cycle_rejects_duplicate(client, manager_headers):
    monday = _next_monday()
    client.post("/api/weekly-cycles", json={"week_start_date": monday.isoformat()}, headers=manager_headers)
    response = client.post(
        "/api/weekly-cycles", json={"week_start_date": monday.isoformat()}, headers=manager_headers
    )
    assert response.status_code == 400


def test_agent_can_view_current_cycle(client, manager_headers, agent_headers):
    monday = _next_monday()
    client.post("/api/weekly-cycles", json={"week_start_date": monday.isoformat()}, headers=manager_headers)

    response = client.get("/api/weekly-cycles/current", headers=agent_headers)
    assert response.status_code == 200
    assert response.json()["week_start_date"] == monday.isoformat()


def test_weekly_cycles_require_auth(client):
    response = client.get("/api/weekly-cycles")
    assert response.status_code == 401
