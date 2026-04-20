from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest  # used by middleware dispatch signature
from starlette.responses import Response

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import WorkflowError

_MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024  # 1 MB


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


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
    )

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

    @app.exception_handler(WorkflowError)
    async def workflow_error_handler(request: Request, exc: WorkflowError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    app.include_router(api_router)
    return app


app = create_app()
