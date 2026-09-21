from uuid import uuid4

import pytest


@pytest.mark.integration
@pytest.mark.asyncio
async def test_register_profile_logout_and_refresh_rejection(api_client):
	phone = f"+919{uuid4().int % 10_000_000_00:010d}"[-13:]
	payload = {
		"full_name": "Integration Member",
		"phone": phone,
		"email": f"{uuid4().hex}@example.com",
		"password": "Member@123",
	}

	register_response = await api_client.post("/api/v1/auth/register", json=payload)
	assert register_response.status_code == 201
	tokens = register_response.json()["data"]

	headers = {"Authorization": f"Bearer {tokens['access_token']}"}
	profile_response = await api_client.get("/api/v1/users/me", headers=headers)
	assert profile_response.status_code == 200
	assert profile_response.json()["data"]["phone"] == phone

	logout_response = await api_client.post("/api/v1/auth/logout", headers=headers)
	assert logout_response.status_code == 200

	rejected_profile = await api_client.get("/api/v1/users/me", headers=headers)
	assert rejected_profile.status_code == 401
	assert rejected_profile.json()["error"]["code"] == "TOKEN_REVOKED"

	refresh_response = await api_client.post(
		"/api/v1/auth/refresh",
		json={"refresh_token": tokens["refresh_token"]},
	)
	assert refresh_response.status_code == 401
	assert refresh_response.json()["error"]["code"] == "TOKEN_REVOKED"
