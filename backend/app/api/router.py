from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.executive import router as executive_router
from app.api.routes.factory import router as factory_router
from app.api.routes.farmer import router as farmer_router
from app.api.routes.health import router as health_router
from app.api.routes.logistics import router as logistics_router
from app.api.routes.warehouse import router as warehouse_router
from app.core.config import get_settings

settings = get_settings()

api_router = APIRouter(prefix=settings.api_prefix)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(farmer_router)
api_router.include_router(logistics_router)
api_router.include_router(factory_router)
api_router.include_router(warehouse_router)
api_router.include_router(executive_router)
