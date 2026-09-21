from typing import Optional

from beanie import init_beanie
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.models import ALL_DOCUMENT_MODELS

# Global client holder
mongo_client: Optional[AsyncIOMotorClient] = None


async def connect_to_database() -> None:
    """Initialize MongoDB connection and Beanie ODM."""
    global mongo_client
    logger.info("Connecting to MongoDB at {}...", settings.MONGODB_URI.split("@")[-1])
    try:
        mongo_client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=8000,
        )
        db = mongo_client[settings.DATABASE_NAME]

        await init_beanie(
            database=db,
            document_models=ALL_DOCUMENT_MODELS,
        )
        logger.info("MongoDB and Beanie ODM initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise e


async def close_database_connection() -> None:
    """Close MongoDB client connection pool."""
    global mongo_client
    if mongo_client:
        logger.info("Closing MongoDB connection...")
        mongo_client.close()
        mongo_client = None
        logger.info("MongoDB connection closed.")


async def check_db_health() -> bool:
    """Ping MongoDB server to ensure database is responsive."""
    if not mongo_client:
        return False
    try:
        await mongo_client.admin.command("ping")
        return True
    except Exception:
        return False
