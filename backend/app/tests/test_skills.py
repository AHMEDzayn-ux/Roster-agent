def test_create_and_list_skills(client, manager_headers):
    response = client.post(
        "/api/skills", json={"name": "Prepaid Sales", "description": "Handles prepaid sales calls"},
        headers=manager_headers,
    )
    assert response.status_code == 201
    skill = response.json()
    assert skill["name"] == "Prepaid Sales"

    response = client.get("/api/skills", headers=manager_headers)
    assert response.status_code == 200
    names = [s["name"] for s in response.json()]
    assert "Prepaid Sales" in names


def test_update_skill(client, manager_headers):
    create = client.post("/api/skills", json={"name": "Cash"}, headers=manager_headers)
    skill_id = create.json()["id"]

    response = client.patch(
        f"/api/skills/{skill_id}", json={"description": "Handles cash transactions"}, headers=manager_headers
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Handles cash transactions"


def test_delete_skill(client, manager_headers):
    create = client.post("/api/skills", json={"name": "English"}, headers=manager_headers)
    skill_id = create.json()["id"]

    response = client.delete(f"/api/skills/{skill_id}", headers=manager_headers)
    assert response.status_code == 204

    response = client.patch(f"/api/skills/{skill_id}", json={"name": "x"}, headers=manager_headers)
    assert response.status_code == 404


def test_agent_forbidden_from_skills(client, agent_headers):
    response = client.get("/api/skills", headers=agent_headers)
    assert response.status_code == 403


def test_create_skill_missing_name_rejected(client, manager_headers):
    response = client.post("/api/skills", json={"description": "no name"}, headers=manager_headers)
    assert response.status_code == 422
