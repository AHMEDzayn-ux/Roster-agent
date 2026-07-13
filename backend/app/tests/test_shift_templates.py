def test_create_and_list_shift_templates(client, manager_headers):
    response = client.post(
        "/api/shift-templates",
        json={"name": "Morning", "start_time": "06:00:00", "end_time": "15:00:00", "break_duration_minutes": 60},
        headers=manager_headers,
    )
    assert response.status_code == 201
    shift = response.json()
    assert shift["name"] == "Morning"
    assert shift["start_time"] == "06:00:00"

    response = client.get("/api/shift-templates", headers=manager_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_update_shift_template(client, manager_headers):
    create = client.post(
        "/api/shift-templates",
        json={"name": "Evening", "start_time": "15:00:00", "end_time": "00:00:00"},
        headers=manager_headers,
    )
    shift_id = create.json()["id"]

    response = client.patch(
        f"/api/shift-templates/{shift_id}", json={"break_duration_minutes": 45}, headers=manager_headers
    )
    assert response.status_code == 200
    assert response.json()["break_duration_minutes"] == 45


def test_delete_shift_template(client, manager_headers):
    create = client.post(
        "/api/shift-templates",
        json={"name": "Night", "start_time": "21:00:00", "end_time": "06:00:00"},
        headers=manager_headers,
    )
    shift_id = create.json()["id"]

    response = client.delete(f"/api/shift-templates/{shift_id}", headers=manager_headers)
    assert response.status_code == 204
