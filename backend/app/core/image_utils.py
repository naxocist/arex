import re
from typing import Optional
from urllib.parse import unquote


def resolve_image_url(path: Optional[str]) -> Optional[str]:
    """Convert a GCS path or GCS URL to a fresh signed URL."""
    if not path:
        return None
    if "storage.googleapis.com" in path:
        m = re.search(r'storage\.googleapis\.com/[^/]+/([^?]+)', path)
        if not m:
            return None
        from cloud_storage.client import get_storage_client
        return get_storage_client().get_signed_url(unquote(m.group(1)))
    if path.startswith("http"):
        return None  # Unknown URL format (e.g. old Supabase URL) — discard
    from cloud_storage.client import get_storage_client
    return get_storage_client().get_signed_url(path)
