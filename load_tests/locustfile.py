# Entry point for Locust. Import all user classes so Locust discovers them.
from users.farmer import FarmerUser
from users.logistics import LogisticsUser
from users.factory import FactoryUser
from users.warehouse import WarehouseUser

__all__ = ["FarmerUser", "LogisticsUser", "FactoryUser", "WarehouseUser"]
