import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest  # used by middleware dispatch signature
from starlette.responses import Response

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import WorkflowError
from app.core.logging import configure_logging

_settings = get_settings()
configure_logging(_settings.environment, _settings.debug)
logger = logging.getLogger(__name__)

_MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024  # 10 MB (allows image uploads)
_SKIP_LOG_PATHS = frozenset({"/", "/api/v1/health", "/docs", "/openapi.json", "/redoc"})
_GCP_PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:
        response: Response = await call_next(request)  # type: ignore[arg-type]
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        if "server" in response.headers:
            del response.headers["server"]
        return response


class LimitRequestSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:  # type: ignore[arg-type]
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _MAX_REQUEST_BODY_BYTES:
            return Response(content="Request body too large", status_code=413)
        return await call_next(request)  # type: ignore[operator]


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:  # type: ignore[arg-type]
        if request.url.path in _SKIP_LOG_PATHS:
            return await call_next(request)  # type: ignore[operator]

        start = time.perf_counter()
        response: Response = await call_next(request)  # type: ignore[arg-type]
        latency_ms = (time.perf_counter() - start) * 1000

        extra: dict = {
            "httpRequest": {
                "requestMethod": request.method,
                "requestUrl": str(request.url),
                "status": response.status_code,
                "latency": f"{latency_ms / 1000:.6f}s",
                "userAgent": request.headers.get("user-agent", ""),
                "remoteIp": request.headers.get("x-forwarded-for", request.client.host if request.client else ""),
            }
        }

        raw_trace = request.headers.get("x-cloud-trace-context", "")
        if raw_trace and _GCP_PROJECT_ID:
            trace_id = raw_trace.split("/")[0]
            extra["logging.googleapis.com/trace"] = f"projects/{_GCP_PROJECT_ID}/traces/{trace_id}"

        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(level, f"{request.method} {request.url.path} {response.status_code}", extra=extra)
        return response


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
    )

    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(LimitRequestSizeMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["system"])
    def root() -> dict[str, str]:
        return {"message": "PMUC Zero Burn to Earn backend is running"}

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning("Validation error: %s %s → %s", request.method, request.url.path, exc.errors())
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.exception_handler(WorkflowError)
    async def workflow_error_handler(request: Request, exc: WorkflowError) -> JSONResponse:
        logger.warning("WorkflowError: %s %s → %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.include_router(api_router)

    logger.info("AREX backend ready", extra={"environment": settings.environment})
    return app


app = create_app()
