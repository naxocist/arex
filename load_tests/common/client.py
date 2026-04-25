from locust import HttpUser
from common import config
from common.auth import login


class ArexClient(HttpUser):
    """Base user class — handles login and injects Bearer token on all requests."""

    abstract = True
    host = config.TARGET_HOST
    _email: str = ""
    _password: str = ""

    def on_start(self) -> None:
        token = login(self.client, self._email, self._password)
        self.client.headers.update({"Authorization": f"Bearer {token}"})
        self.setup()

    def setup(self) -> None:
        """Override in subclasses for role-specific on_start logic."""
