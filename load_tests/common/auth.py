def login(client, email: str, password: str) -> str:
    """POST /api/v1/auth/login — returns access_token. Raises on failure."""
    with client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        catch_response=True,
        name="POST /auth/login",
    ) as resp:
        if resp.status_code == 200:
            resp.success()
            return resp.json()["access_token"]
        resp.failure(f"Login failed: {resp.status_code} {resp.text}")
        raise RuntimeError(f"Login failed for {email}: {resp.status_code}")
