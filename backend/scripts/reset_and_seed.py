from __future__ import annotations

import argparse
import base64
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

import supabase
from supabase import Client, create_client

ZERO_UUID = "00000000-0000-0000-0000-000000000000"
FARMER_1_ID = "f4ef8667-e708-4a4c-bda5-3454c141748e"
FARMER_2_ID = "f6cfce13-7f5e-4a13-a12d-38e03f19bbf3"
LOGISTICS_ID = "9860d98c-94dd-40af-a8ae-a90bfcd5c1d0"
FACTORY_PROFILE_ID = "0e252cd8-faaf-4396-b37e-64e8d841c69c"
WAREHOUSE_ID = "9eaf4ed3-cd66-4f48-8b0b-d5d905fd9370"
EXECUTIVE_ID = "23a28b56-2dcd-4388-ad15-415bd32150ec"


@dataclass(frozen=True)
class DemoUser:
    id: str
    role: str
    email: str
    password: str
    display_name: str
    phone: str
    province: str


DEMO_USERS: list[DemoUser] = [
    DemoUser(
        id=FARMER_1_ID,
        role="farmer",
        email="farmer.demo@arex.local",
        password="Demo12345!",
        display_name="สมชาย เกษตรกร",
        phone="0810001001",
        province="เพชรบูรณ์",
    ),
    DemoUser(
        id=FARMER_2_ID,
        role="farmer",
        email="farmer2.demo@arex.local",
        password="Demo12345!",
        display_name="สมหญิง เกษตรกร",
        phone="0810001002",
        province="นครราชสีมา",
    ),
    DemoUser(
        id=LOGISTICS_ID,
        role="logistics",
        email="logistics.demo@arex.local",
        password="Demo12345!",
        display_name="เอกชัย ขนส่ง",
        phone="0810002001",
        province="สระบุรี",
    ),
    DemoUser(
        id=FACTORY_PROFILE_ID,
        role="factory",
        email="factory.demo@arex.local",
        password="Demo12345!",
        display_name="วรินทร์ โรงงาน",
        phone="0810003001",
        province="สระบุรี",
    ),
    DemoUser(
        id=WAREHOUSE_ID,
        role="warehouse",
        email="warehouse.demo@arex.local",
        password="Demo12345!",
        display_name="มานพ คลังสินค้า",
        phone="0810004001",
        province="ปทุมธานี",
    ),
    DemoUser(
        id=EXECUTIVE_ID,
        role="executive",
        email="executive.demo@arex.local",
        password="Demo12345!",
        display_name="ผู้บริหาร AREX",
        phone="0810005001",
        province="กรุงเทพมหานคร",
    ),
]


FACTORY_SITE_ID = "00000000-0000-4000-8000-00000000f001"
REWARD_1_ID = "00000000-0000-4000-8000-00000000a001"
REWARD_2_ID = "00000000-0000-4000-8000-00000000a002"


def _iso_hours_ago(hours: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def _decode_jwt_role(token: str) -> str | None:
    parts = token.split(".")
    if len(parts) < 2:
        return None

    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    parsed = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
    role = parsed.get("role") or parsed.get("user_role")
    if isinstance(role, str):
        return role
    return None


def _validate_secret_key(secret_key: str) -> None:
    # Supabase legacy keys are JWT; service-role keys have role=service_role.
    # New secret keys (sb_secret_...) are non-JWT and still admin-capable.
    if secret_key.startswith("sb_secret_"):
        return

    try:
        role = _decode_jwt_role(secret_key)
    except Exception:
        role = None

    if role == "anon":
        raise RuntimeError(
            "SUPABASE_SECRET_KEY is set to a publishable/anon key. "
            "Use your project's secret key (or legacy service_role JWT) for admin operations."
        )

    if role is not None and role != "service_role":
        raise RuntimeError(
            "Configured service key JWT role is not service_role. "
            "Use a service_role JWT key for admin operations."
        )


def _select_supabase_key_for_client(secret_key: str, legacy_service_jwt: str) -> str:
    # supabase-py==2.15.3 validates API keys as JWT and rejects sb_secret_* keys.
    if secret_key.startswith("sb_secret_"):
        if legacy_service_jwt:
            return legacy_service_jwt

        client_version = getattr(supabase, "__version__", "unknown")
        raise RuntimeError(
            "Current Python client rejects sb_secret_* keys as Invalid API key. "
            f"Installed supabase-py version: {client_version}. "
            "Set SUPABASE_LEGACY_SERVICE_ROLE_JWT (legacy service_role JWT key) in backend/.env for this script, "
            "or upgrade the client stack to a version that supports secret keys."
        )

    return secret_key


def _load_env() -> tuple[str, str]:
    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    legacy_service_jwt = os.getenv("SUPABASE_LEGACY_SERVICE_ROLE_JWT", "").strip()

    if not supabase_url:
        raise RuntimeError("SUPABASE_URL is required")
    if not secret_key:
        raise RuntimeError("SUPABASE_SECRET_KEY is required")

    selected_key = _select_supabase_key_for_client(secret_key, legacy_service_jwt)
    return supabase_url, selected_key


def _delete_all_rows(client: Client, table: str, key_column: str) -> None:
    sentinel = ZERO_UUID if key_column.endswith("id") else "__never_match__"
    client.table(table).delete().neq(key_column, sentinel).execute()


def _reset_app_tables(client: Client) -> None:
    _delete_all_rows(client, "reward_delivery_jobs", "id")
    _delete_all_rows(client, "factory_intakes", "id")
    _delete_all_rows(client, "pickup_jobs", "id")
    _delete_all_rows(client, "reward_requests", "id")
    _delete_all_rows(client, "points_ledger", "id")
    _delete_all_rows(client, "status_events", "id")
    _delete_all_rows(client, "material_submissions", "id")
    _delete_all_rows(client, "factories", "id")
    _delete_all_rows(client, "rewards_catalog", "id")
    _delete_all_rows(client, "material_point_rules", "material_type")
    _delete_all_rows(client, "measurement_units", "code")
    _delete_all_rows(client, "material_types", "code")


def _delete_existing_demo_auth_users(client: Client) -> None:
    target_emails = {user.email.lower() for user in DEMO_USERS}
    target_ids = {user.id for user in DEMO_USERS}

    page = 1
    per_page = 1000

    while True:
        users = client.auth.admin.list_users(page=page, per_page=per_page)
        if not users:
            break

        for user in users:
            user_email = (user.email or "").lower()
            if user_email in target_emails or user.id in target_ids:
                try:
                    client.auth.admin.delete_user(user.id, should_soft_delete=True)
                except Exception as exc:
                    print(
                        f"Warning: could not delete auth user {user.id} ({user_email}): {exc}. "
                        "Will continue and attempt update-or-create during seed."
                    )

        if len(users) < per_page:
            break
        page += 1


def _create_demo_auth_and_profiles(client: Client) -> dict[str, str]:
    existing_users = client.auth.admin.list_users(page=1, per_page=5000)
    existing_by_email = {
        (item.email or "").lower(): item
        for item in existing_users
        if (item.email or "").strip()
    }
    resolved_ids_by_email: dict[str, str] = {}

    for user in DEMO_USERS:
        normalized_email = user.email.lower()
        existing_user = existing_by_email.get(normalized_email)

        if existing_user is not None:
            updated = client.auth.admin.update_user_by_id(
                existing_user.id,
                {
                    "password": user.password,
                    "email_confirm": True,
                    "user_metadata": {
                        "role": user.role,
                        "display_name": user.display_name,
                    },
                    "app_metadata": {
                        "role": user.role,
                    },
                },
            )
            auth_user = updated.user
        else:
            created = client.auth.admin.create_user(
                {
                    "email": user.email,
                    "password": user.password,
                    "email_confirm": True,
                    "user_metadata": {
                        "role": user.role,
                        "display_name": user.display_name,
                    },
                    "app_metadata": {
                        "role": user.role,
                    },
                }
            )
            auth_user = created.user

        if auth_user is None:
            raise RuntimeError(f"Failed to upsert auth user for {user.email}")

        resolved_ids_by_email[normalized_email] = auth_user.id

        client.table("profiles").upsert(
            {
                "id": auth_user.id,
                "role": user.role,
                "display_name": user.display_name,
                "phone": user.phone,
                "province": user.province,
            },
            on_conflict="id",
        ).execute()

    return resolved_ids_by_email


def _seed_master_data(client: Client, resolved_ids_by_email: dict[str, str]) -> None:
    client.table("material_types").upsert(
        [
            {"code": "rice_straw", "name_th": "ฟางข้าว", "active": True},
            {"code": "cassava_root", "name_th": "รากมันสำปะหลัง", "active": True},
            {"code": "sugarcane_bagasse", "name_th": "ชานอ้อย", "active": True},
            {"code": "corn_stover", "name_th": "ซังและลำต้นข้าวโพด", "active": True},
        ],
        on_conflict="code",
    ).execute()

    client.table("measurement_units").upsert(
        [
            {"code": "kg", "name_th": "กิโลกรัม", "to_kg_factor": 1.0, "active": True},
            {"code": "ton", "name_th": "ตัน", "to_kg_factor": 1000.0, "active": True},
            {
                "code": "m3",
                "name_th": "ลูกบาศก์เมตร",
                "to_kg_factor": None,
                "active": True,
            },
        ],
        on_conflict="code",
    ).execute()

    client.table("material_point_rules").upsert(
        [
            {"material_type": "rice_straw", "points_per_kg": 1.20},
            {"material_type": "cassava_root", "points_per_kg": 1.10},
            {"material_type": "sugarcane_bagasse", "points_per_kg": 0.95},
            {"material_type": "corn_stover", "points_per_kg": 1.00},
        ],
        on_conflict="material_type",
    ).execute()

    client.table("rewards_catalog").upsert(
        [
            {
                "id": REWARD_1_ID,
                "name_th": "ปุ๋ยอินทรีย์",
                "description_th": "ขนาด 25 กก.",
                "points_cost": 1200,
                "stock_qty": 500,
                "active": True,
            },
            {
                "id": REWARD_2_ID,
                "name_th": "เมล็ดพันธุ์ข้าว",
                "description_th": "เมล็ดพันธุ์คัดเกรด",
                "points_cost": 600,
                "stock_qty": 800,
                "active": True,
            },
        ],
        on_conflict="id",
    ).execute()

    client.table("factories").upsert(
        {
            "id": FACTORY_SITE_ID,
            "factory_profile_id": resolved_ids_by_email["factory.demo@arex.local"],
            "name_th": "โรงงานชีวมวล AREX - สระบุรี",
            "location_text": "จ.สระบุรี",
            "lat": 14.528915,
            "lng": 100.910142,
            "active": True,
        },
        on_conflict="id",
    ).execute()


def _seed_workflow_data(client: Client, resolved_ids_by_email: dict[str, str]) -> None:
    farmer_1 = resolved_ids_by_email["farmer.demo@arex.local"]
    farmer_2 = resolved_ids_by_email["farmer2.demo@arex.local"]
    logistics = resolved_ids_by_email["logistics.demo@arex.local"]
    warehouse = resolved_ids_by_email["warehouse.demo@arex.local"]

    submissions: list[dict[str, Any]] = [
        {
            "id": "10000000-0000-4000-8000-000000000001",
            "farmer_profile_id": farmer_1,
            "material_type": "rice_straw",
            "quantity_value": 10.0,
            "quantity_unit": "ton",
            "pickup_location_text": "ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์",
            "pickup_lat": 16.04905,
            "pickup_lng": 101.14966,
            "notes": "seed: submitted #1",
            "status": "submitted",
            "created_at": _iso_hours_ago(72),
            "updated_at": _iso_hours_ago(72),
        },
        {
            "id": "10000000-0000-4000-8000-000000000002",
            "farmer_profile_id": farmer_1,
            "material_type": "cassava_root",
            "quantity_value": 7.5,
            "quantity_unit": "ton",
            "pickup_location_text": "อ.เมือง จ.นครราชสีมา",
            "pickup_lat": 14.97990,
            "pickup_lng": 102.09777,
            "notes": "seed: pickup_scheduled",
            "status": "pickup_scheduled",
            "created_at": _iso_hours_ago(48),
            "updated_at": _iso_hours_ago(24),
        },
        {
            "id": "10000000-0000-4000-8000-000000000003",
            "farmer_profile_id": farmer_2,
            "material_type": "sugarcane_bagasse",
            "quantity_value": 12.0,
            "quantity_unit": "ton",
            "pickup_location_text": "อ.พานทอง จ.ชลบุรี",
            "pickup_lat": 13.45896,
            "pickup_lng": 101.08041,
            "notes": "seed: picked_up",
            "status": "picked_up",
            "created_at": _iso_hours_ago(36),
            "updated_at": _iso_hours_ago(8),
        },
        {
            "id": "10000000-0000-4000-8000-000000000004",
            "farmer_profile_id": farmer_2,
            "material_type": "corn_stover",
            "quantity_value": 9.0,
            "quantity_unit": "ton",
            "pickup_location_text": "อ.แม่แจ่ม จ.เชียงใหม่",
            "pickup_lat": 18.59813,
            "pickup_lng": 98.36322,
            "notes": "seed: delivered_to_factory",
            "status": "delivered_to_factory",
            "created_at": _iso_hours_ago(28),
            "updated_at": _iso_hours_ago(4),
        },
    ]

    client.table("material_submissions").upsert(submissions, on_conflict="id").execute()

    pickup_jobs: list[dict[str, Any]] = [
        {
            "id": "20000000-0000-4000-8000-000000000002",
            "submission_id": "10000000-0000-4000-8000-000000000002",
            "logistics_profile_id": logistics,
            "destination_factory_id": FACTORY_SITE_ID,
            "planned_pickup_at": _iso_hours_ago(-6),
            "pickup_window_end_at": _iso_hours_ago(-2),
            "status": "pickup_scheduled",
            "notes": "seed pickup scheduled",
            "created_at": _iso_hours_ago(24),
            "updated_at": _iso_hours_ago(24),
        },
        {
            "id": "20000000-0000-4000-8000-000000000003",
            "submission_id": "10000000-0000-4000-8000-000000000003",
            "logistics_profile_id": logistics,
            "destination_factory_id": FACTORY_SITE_ID,
            "planned_pickup_at": _iso_hours_ago(12),
            "pickup_window_end_at": _iso_hours_ago(10),
            "picked_up_at": _iso_hours_ago(8),
            "status": "picked_up",
            "notes": "seed pickup in transit",
            "created_at": _iso_hours_ago(18),
            "updated_at": _iso_hours_ago(8),
        },
        {
            "id": "20000000-0000-4000-8000-000000000004",
            "submission_id": "10000000-0000-4000-8000-000000000004",
            "logistics_profile_id": logistics,
            "destination_factory_id": FACTORY_SITE_ID,
            "planned_pickup_at": _iso_hours_ago(24),
            "pickup_window_end_at": _iso_hours_ago(22),
            "picked_up_at": _iso_hours_ago(20),
            "delivered_factory_at": _iso_hours_ago(4),
            "status": "delivered_to_factory",
            "notes": "seed ready for factory intake",
            "created_at": _iso_hours_ago(24),
            "updated_at": _iso_hours_ago(4),
        },
    ]

    client.table("pickup_jobs").upsert(pickup_jobs, on_conflict="id").execute()

    client.table("points_ledger").upsert(
        [
            {
                "id": "50000000-0000-4000-8000-000000000001",
                "farmer_profile_id": farmer_1,
                "entry_type": "adjustment",
                "points_amount": 5000,
                "reference_type": "seed",
                "note": "seed initial points",
                "created_at": _iso_hours_ago(72),
            },
            {
                "id": "50000000-0000-4000-8000-000000000002",
                "farmer_profile_id": farmer_2,
                "entry_type": "adjustment",
                "points_amount": 3500,
                "reference_type": "seed",
                "note": "seed initial points",
                "created_at": _iso_hours_ago(72),
            },
        ],
        on_conflict="id",
    ).execute()

    reward_requests: list[dict[str, Any]] = [
        {
            "id": "30000000-0000-4000-8000-000000000001",
            "farmer_profile_id": farmer_1,
            "reward_id": REWARD_1_ID,
            "quantity": 1,
            "requested_points": 1200,
            "status": "requested",
            "requested_at": _iso_hours_ago(6),
            "updated_at": _iso_hours_ago(6),
        },
        {
            "id": "30000000-0000-4000-8000-000000000002",
            "farmer_profile_id": farmer_2,
            "reward_id": REWARD_2_ID,
            "quantity": 1,
            "requested_points": 600,
            "status": "warehouse_approved",
            "warehouse_profile_id": warehouse,
            "warehouse_decision_at": _iso_hours_ago(5),
            "requested_at": _iso_hours_ago(8),
            "updated_at": _iso_hours_ago(5),
        },
    ]

    client.table("reward_requests").upsert(reward_requests, on_conflict="id").execute()

    client.table("reward_delivery_jobs").upsert(
        {
            "id": "60000000-0000-4000-8000-000000000001",
            "reward_request_id": "30000000-0000-4000-8000-000000000002",
            "logistics_profile_id": logistics,
            "planned_delivery_at": _iso_hours_ago(-4),
            "delivery_window_end_at": _iso_hours_ago(-1),
            "status": "reward_delivery_scheduled",
            "notes": "seed reward delivery scheduled",
            "created_at": _iso_hours_ago(4),
            "updated_at": _iso_hours_ago(4),
        },
        on_conflict="id",
    ).execute()


def reset_and_seed(client: Client) -> None:
    _reset_app_tables(client)
    try:
        resolved_ids_by_email = _create_demo_auth_and_profiles(client)
    except Exception as exc:
        message = str(exc).lower()
        if "user not allowed" in message or "403" in message:
            raise RuntimeError(
                "Supabase Auth admin API denied auth user creation. "
                "Check SUPABASE_SECRET_KEY permissions."
            ) from exc
        raise

    _seed_master_data(client, resolved_ids_by_email)
    _seed_workflow_data(client, resolved_ids_by_email)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset AREX data and seed deterministic demo users/data (including Supabase Auth).",
    )
    parser.add_argument(
        "--confirm",
        required=True,
        help="Type RESET_AREX_DATA to execute reset and seed",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.confirm != "RESET_AREX_DATA":
        raise RuntimeError(
            "Confirmation string mismatch. Use --confirm RESET_AREX_DATA"
        )

    supabase_url, secret_key = _load_env()
    _validate_secret_key(secret_key)
    client = create_client(supabase_url, secret_key)

    reset_and_seed(client)

    print("Reset and seed completed successfully.")
    print("Created demo auth users:")
    for user in DEMO_USERS:
        print(f"- {user.role}: {user.email} (password: {user.password})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
