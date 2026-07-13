def test_login_success(client, manager_user):
    response = client.post(
        "/api/auth/login", json={"email": "manager@callroster-demo.com", "password": "managerpass123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password(client, manager_user):
    response = client.post(
        "/api/auth/login", json={"email": "manager@callroster-demo.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_login_unknown_email(client):
    response = client.post(
        "/api/auth/login", json={"email": "nobody@callroster-demo.com", "password": "whatever123"}
    )
    assert response.status_code == 401


def test_manager_can_create_user(client, manager_headers):
    response = client.post(
        "/api/auth/users",
        json={"email": "newagent@callroster-demo.com", "password": "newagentpass1", "role": "agent"},
        headers=manager_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "newagent@callroster-demo.com"
    assert body["role"] == "agent"


def test_agent_cannot_create_user(client, agent_headers):
    response = client.post(
        "/api/auth/users",
        json={"email": "another@callroster-demo.com", "password": "anotherpass1", "role": "agent"},
        headers=agent_headers,
    )
    assert response.status_code == 403


def test_create_user_duplicate_email_rejected(client, manager_headers, manager_user):
    response = client.post(
        "/api/auth/users",
        json={"email": manager_user.email, "password": "somepassword1", "role": "manager"},
        headers=manager_headers,
    )
    assert response.status_code == 400


def test_unauthenticated_request_rejected(client):
    response = client.get("/api/skills")
    assert response.status_code == 401
