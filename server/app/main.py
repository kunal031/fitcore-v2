from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import router as api_v1_router
from app.core.config import settings
from app.core.database import (
    check_db_health,
    close_database_connection,
    connect_to_database,
)
from app.core.exceptions import FitCoreException
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Initializing FitCore v2 server...")
    await connect_to_database()
    start_scheduler()
    logger.info("FitCore v2 server is ready.")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down FitCore v2 server...")
    stop_scheduler()
    await close_database_connection()
    logger.info("FitCore v2 server shutdown complete.")


app = FastAPI(
    title="FitCore Gym Management API",
    description="Scalable mobile-centered Indian gym management backend platform.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)


# ── Global Exception Handlers ─────────────────────────────────────────────────
@app.exception_handler(FitCoreException)
async def fitcore_exception_handler(request: Request, exc: FitCoreException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "message": exc.message,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "field": exc.field,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    loc = ".".join(str(x) for x in first_error.get("loc", []))
    msg = first_error.get("msg", "Invalid request payload")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "data": None,
            "message": f"Validation error at {loc}: {msg}",
            "error": {
                "code": "VALIDATION_ERROR",
                "message": msg,
                "field": loc,
            },
        },
    )


# ── Root & Health Endpoints ───────────────────────────────────────────────────
@app.get("/", tags=["General"])
async def root():
    return {
        "name": "FitCore Gym Management API",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "online",
    }


@app.get("/health", tags=["General"])
async def health_check():
    db_ok = await check_db_health()
    return {
        "success": True,
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": "2.0.0",
    }


# ── Mount V1 API Routers ──────────────────────────────────────────────────────
app.include_router(api_v1_router, prefix="/api/v1")
