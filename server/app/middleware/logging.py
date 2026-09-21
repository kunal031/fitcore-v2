import time
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path

        # Process the request
        try:
            response: Response = await call_next(request)
            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(
                f"{method} {path} | Status: {response.status_code} | "
                f"Time: {duration_ms}ms | IP: {client_ip}"
            )
            return response
        except Exception as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                f"{method} {path} | Exception: {exc} | "
                f"Time: {duration_ms}ms | IP: {client_ip}"
            )
            raise exc
