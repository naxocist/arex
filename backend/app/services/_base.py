from typing import Any

from supabase import Client

from app.core.errors import WorkflowError


def _first_row(data: Any) -> dict[str, Any]:
    if isinstance(data, list):
        if not data:
            raise WorkflowError("No data returned from database operation")
        first = data[0]
        if not isinstance(first, dict):
            raise WorkflowError("Unexpected database response shape")
        return first

    if isinstance(data, dict):
        return data

    raise WorkflowError("Unexpected database response type")


class BaseService:
    def __init__(self, client: Client):
        self.client = client
