import os
from pathlib import Path
from dotenv import load_dotenv

_env = os.getenv("ENV", "staging")

if _env != "ci":
    _env_file = Path(__file__).parent.parent / ".env"
    if not _env_file.exists():
        raise FileNotFoundError(
            f"Load test env file not found: {_env_file}\n"
            f"Copy load_tests/.env.example to load_tests/.env and fill in values.\n"
            f"Or set ENV=ci and inject all LOAD_TEST_* variables directly."
        )
    load_dotenv(_env_file)

TARGET_HOST: str = os.environ["LOAD_TEST_TARGET_HOST"]

LOGISTICS_EMAIL: str = os.environ["LOAD_TEST_LOGISTICS_EMAIL"]
LOGISTICS_PASSWORD: str = os.environ["LOAD_TEST_LOGISTICS_PASSWORD"]

FACTORY_EMAIL: str = os.environ["LOAD_TEST_FACTORY_EMAIL"]
FACTORY_PASSWORD: str = os.environ["LOAD_TEST_FACTORY_PASSWORD"]

WAREHOUSE_EMAIL: str = os.environ["LOAD_TEST_WAREHOUSE_EMAIL"]
WAREHOUSE_PASSWORD: str = os.environ["LOAD_TEST_WAREHOUSE_PASSWORD"]

ADMIN_EMAIL: str = os.environ["LOAD_TEST_ADMIN_EMAIL"]
ADMIN_PASSWORD: str = os.environ["LOAD_TEST_ADMIN_PASSWORD"]
