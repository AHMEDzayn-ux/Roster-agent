def _create_skill(client, manager_headers, name="Prepaid Sales"):
    return client.post("/api/skills", json={"name": name}, headers=manager_headers).json()


def test_create_and_list_coverage_requirement(client, manager_headers):
    skill = _create_skill(client, manager_headers)

    response = client.post(
        "/api/coverage-requirements",
        json={
            "day_of_week": 0,
            "time_slot_start": "09:00:00",
            "time_slot_end": "10:00:00",
            "skill_id": skill["id"],
            "min_agents_required": 3,
            "is_peak": True,
            "weight": 2.0,
        },
        headers=manager_headers,
    )
    assert response.status_code == 201
    req = response.json()
    assert req["min_agents_required"] == 3
    assert req["is_peak"] is True

    response = client.get("/api/coverage-requirements", headers=manager_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_invalid_day_of_week_rejected(client, manager_headers):
    skill = _create_skill(client, manager_headers)
    response = client.post(
        "/api/coverage-requirements",
        json={
            "day_of_week": 9,
            "time_slot_start": "09:00:00",
            "time_slot_end": "10:00:00",
            "skill_id": skill["id"],
            "min_agents_required": 1,
        },
        headers=manager_headers,
    )
    assert response.status_code == 422


def test_update_and_delete_coverage_requirement(client, manager_headers):
    skill = _create_skill(client, manager_headers)
    create = client.post(
        "/api/coverage-requirements",
        json={
            "day_of_week": 1,
            "time_slot_start": "10:00:00",
            "time_slot_end": "11:00:00",
            "skill_id": skill["id"],
            "min_agents_required": 2,
        },
        headers=manager_headers,
    )
    req_id = create.json()["id"]

    response = client.patch(
        f"/api/coverage-requirements/{req_id}", json={"min_agents_required": 5}, headers=manager_headers
    )
    assert response.status_code == 200
    assert response.json()["min_agents_required"] == 5

    response = client.delete(f"/api/coverage-requirements/{req_id}", headers=manager_headers)
    assert response.status_code == 204
