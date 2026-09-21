import os
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.main import app
from app.models import ALL_DOCUMENT_MODELS


@pytest_asyncio.fixture(scope="session")
async def mongo_database():
	mongo_uri = os.getenv("TEST_MONGODB_URI")
	if not mongo_uri:
		pytest.skip("Set TEST_MONGODB_URI to run MongoDB integration tests.")

	client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=1000)
	try:
		await client.admin.command("ping")
	except Exception:
		client.close()
		pytest.skip("MongoDB is not available at TEST_MONGODB_URI.")

	database = client[f"fitcore_test_{uuid4().hex}"]
	await init_beanie(database=database, document_models=ALL_DOCUMENT_MODELS)
	yield database

	await database.client.drop_database(database.name)
	client.close()


@pytest_asyncio.fixture
async def api_client(mongo_database):
	transport = httpx.ASGITransport(app=app)
	async with httpx.AsyncClient(
		transport=transport,
		base_url="http://testserver",
	) as client:
		yield client
