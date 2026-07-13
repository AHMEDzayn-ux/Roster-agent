from datetime import date


def test_manager_creates_and_views_leave_balance(client, manager_headers, agent_record):
    year = date.today().year
    response = client.post(
        "/api/leave-balance",
        json={"agent_id": agent_record.id, "year": year, "total_leave_days_allotted": 21},
        headers=manager_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["remaining_balance"] == 21
    assert body["leave_days_taken"] == 0

    response = client.get(f"/api/leave-balance/{agent_record.id}?year={year}", headers=manager_headers)
    assert response.status_code == 200
    assert response.json()["total_leave_days_allotted"] == 21


def test_duplicate_leave_balance_rejected(client, manager_headers, agent_record):
    year = date.today().year
    payload = {"agent_id": agent_record.id, "year": year, "total_leave_days_allotted": 21}
    client.post("/api/leave-balance", json=payload, headers=manager_headers)
    response = client.post("/api/leave-balance", json=payload, headers=manager_headers)
    assert response.status_code == 400


def test_agent_views_own_leave_balance(client, manager_headers, agent_headers, agent_record):
    year = date.today().year
    client.post(
        "/api/leave-balance",
        json={"agent_id": agent_record.id, "year": year, "total_leave_days_allotted": 15},
        headers=manager_headers,
    )
    response = client.get("/api/leave-balance/mine", headers=agent_headers)
    assert response.status_code == 200
    assert response.json()["agent_id"] == agent_record.id


def test_manager_updates_leave_allotment(client, manager_headers, agent_record):
    year = date.today().year
    client.post(
        "/api/leave-balance",
        json={"agent_id": agent_record.id, "year": year, "total_leave_days_allotted": 10},
        headers=manager_headers,
    )
    response = client.patch(
        f"/api/leave-balance/{agent_record.id}?year={year}",
        json={"total_leave_days_allotted": 18},
        headers=manager_headers,
    )
    assert response.status_code == 200
    assert response.json()["remaining_balance"] == 18


def test_agent_cannot_create_leave_balance(client, agent_headers, agent_record):
    response = client.post(
        "/api/leave-balance",
        json={"agent_id": agent_record.id, "year": date.today().year, "total_leave_days_allotted": 10},
        headers=agent_headers,
    )
    assert response.status_code == 403
