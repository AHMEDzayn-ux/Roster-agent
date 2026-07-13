def _create_skill(client, manager_headers, name):
    return client.post("/api/skills", json={"name": name}, headers=manager_headers).json()


def _create_shift(client, manager_headers):
    return client.post(
        "/api/shift-templates",
        json={"name": "Morning", "start_time": "06:00:00", "end_time": "15:00:00"},
        headers=manager_headers,
    ).json()


def test_create_agent_with_skills_and_shift(client, manager_headers):
    skill_a = _create_skill(client, manager_headers, "Prepaid Sales")
    skill_b = _create_skill(client, manager_headers, "Cash")
    shift = _create_shift(client, manager_headers)

    response = client.post(
        "/api/agents",
        json={
            "name": "Ravi Kumar",
            "contact_info": "ravi@example.com",
            "default_shift_id": shift["id"],
            "default_off_day_type": "fixed",
            "default_off_day": 6,
            "skill_ids": [skill_a["id"], skill_b["id"]],
        },
        headers=manager_headers,
    )
    assert response.status_code == 201
    agent = response.json()
    assert agent["name"] == "Ravi Kumar"
    assert agent["default_off_day"] == 6
    assert sorted(agent["skill_ids"]) == sorted([skill_a["id"], skill_b["id"]])


def test_update_agent_skills(client, manager_headers):
    skill_a = _create_skill(client, manager_headers, "Prepaid Sales")
    skill_b = _create_skill(client, manager_headers, "Cash")

    create = client.post("/api/agents", json={"name": "Priya", "skill_ids": [skill_a["id"]]}, headers=manager_headers)
    agent_id = create.json()["id"]
    assert create.json()["skill_ids"] == [skill_a["id"]]

    response = client.patch(
        f"/api/agents/{agent_id}", json={"skill_ids": [skill_b["id"]]}, headers=manager_headers
    )
    assert response.status_code == 200
    assert response.json()["skill_ids"] == [skill_b["id"]]


def test_delete_agent(client, manager_headers):
    create = client.post("/api/agents", json={"name": "Temp Agent"}, headers=manager_headers)
    agent_id = create.json()["id"]

    response = client.delete(f"/api/agents/{agent_id}", headers=manager_headers)
    assert response.status_code == 204

    response = client.patch(f"/api/agents/{agent_id}", json={"name": "x"}, headers=manager_headers)
    assert response.status_code == 404


def test_agent_role_forbidden_from_agents_endpoint(client, agent_headers):
    response = client.get("/api/agents", headers=agent_headers)
    assert response.status_code == 403


def test_default_off_day_out_of_range_rejected(client, manager_headers):
    response = client.post(
        "/api/agents",
        json={"name": "Bad Agent", "default_off_day_type": "fixed", "default_off_day": 10},
        headers=manager_headers,
    )
    assert response.status_code == 422
