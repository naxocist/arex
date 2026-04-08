from enum import Enum

from pydantic import BaseModel


class Role(str, Enum):
    FARMER = "farmer"
    LOGISTICS = "logistics"
    FACTORY = "factory"
    EXECUTIVE = "executive"
    WAREHOUSE = "warehouse"
    ADMIN = "admin"


class AuthenticatedUser(BaseModel):
    user_id: str
    email: str | None = None
    role: Role
