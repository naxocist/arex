import uuid

from fastapi import APIRouter, Depends, Query, UploadFile, File

from app.api.deps import require_roles
from app.models.auth import AuthenticatedUser, Role
from cloud_storage.client import get_storage_client

router = APIRouter(prefix="/images", tags=["images"])

_ALLOWED_ROLES_UPLOAD_SUBMISSION = (Role.FARMER,)
_ALLOWED_ROLES_UPLOAD_REWARD = (Role.EXECUTIVE, Role.ADMIN, Role.FACTORY)
_ALL_ROLES = tuple(Role)


@router.post("/upload/submission")
async def upload_submission_image(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(require_roles(*_ALLOWED_ROLES_UPLOAD_SUBMISSION)),
) -> dict:
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    path = f"submission-images/{uuid.uuid4()}.{ext}"
    data = await file.read()
    client = get_storage_client()
    client.upload_bytes(data, path, file.content_type or "image/jpeg")
    return {"path": path, "url": client.get_signed_url(path)}


@router.post("/upload/reward")
async def upload_reward_image(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(require_roles(*_ALLOWED_ROLES_UPLOAD_REWARD)),
) -> dict:
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    path = f"reward-images/{uuid.uuid4()}.{ext}"
    data = await file.read()
    client = get_storage_client()
    client.upload_bytes(data, path, file.content_type or "image/jpeg")
    return {"path": path, "url": client.get_signed_url(path)}


@router.delete("")
async def delete_image(
    path: str = Query(..., description="GCS blob path to delete"),
    current_user: AuthenticatedUser = Depends(require_roles(*_ALL_ROLES)),
) -> dict:
    if path.startswith("http"):
        # Legacy Supabase URL — nothing to do on GCS side
        return {"deleted": False, "reason": "legacy_url"}
    get_storage_client().delete_blob(path)
    return {"deleted": True, "path": path}
