# AREX Product Change Plan
Source: AREX Product Changes.pdf — Meeting 9 April 2568
Deadline: **26 April 2568** (Demo Script D-06, day before Minister presentation)

---

## Core Design Decisions

### 1. Points (PMUC Coins) are the ONLY exchange currency
No direct item-to-item barter. The flow is always:
```
Material delivered & confirmed → Coins credited → Farmer spends Coins on rewards
```
Exchange rates define: **how many coins per unit of material**. Executive sets and changes these rates anytime. Farmer just brings material and spends coins — no group role, no pair lookup.

### 2. Farmer has no group/role distinction
Farmers submit any material they have. The material type itself determines the coin rate (via `material_point_rules`). No `user_group` field on farmer profile needed.

### 3. Units are independent from material
`measurement_units` table is a standalone lookup. Material submissions reference a unit code. No coupling required.

### 4. Existing architecture stays — minimal changes
- `material_point_rules` (points_per_kg) = already the right place for exchange rate. **Executive just needs UI to edit this.**
- `rewards_catalog` (points_cost) = already the right place for reward cost. Already editable.
- `points_ledger` = already correct audit trail.
- `request_reward_trade` DB function = already validates points balance. **No change needed.**

---

## What Actually Needs to Change

### A. Data — seed missing items (DB migration)

**Add `bale` to measurement_units:**
```sql
insert into measurement_units (code, label_th, to_kg_factor)
values ('bale', 'ก้อน', 12.5);  -- 1 bale ≈ 12.5 kg straw (confirm with อ.จุ๊บ)
```
Note: `to_kg_factor` converts to kg for the points calculation. Units are independent — any material can use any unit.

**Add missing material types:**
```sql
insert into material_types (code, name_th, active) values
  ('rice_straw',       'ฟาง',              true),
  ('orchard_residue',  'เศษเหลือทิ้งสวน', true),
  ('plastic_waste',    'ขยะพลาสติก',       true);
```

**Set coin rates in material_point_rules** (executive-editable, these are defaults from PDF):

| material_type | coins_per_kg | Implied from PDF |
|---|---|---|
| rice_straw | 1.0 | 10 bales (125 kg) → 10L biodiesel ≈ 125 coins |
| orchard_residue | 1.0 | 50 kg → same tier |
| plastic_waste | 1.0 | 10 kg → same tier |

> Exact rates to confirm with stakeholders. Executive can adjust in UI without migration.

**Fix mulch cover reward name** (wrong → correct):
```sql
update rewards_catalog
set name_th = 'แผ่นคลุมดินชีวมวล (เยื่อธรรมชาติ)',
    description_th = 'เยื่อธรรมชาติจากชีวมวล — ไม่ใช่พลาสติก'
where name_th ilike '%แผ่นคลุมดิน%' or name_th ilike '%PPP%';
```

**Seed rewards catalog** (if not yet seeded):
```sql
insert into rewards_catalog (name_th, description_th, points_cost, stock_qty, active) values
  ('ไบโอดีเซล 10 ลิตร',       'น้ำมันไบโอดีเซล จาก GTR/น้ำมันพืชปทุม', 125,  10000, true),
  ('โซลาร์เซลล์มือสอง 1 แผง', 'แผงโซลาร์เซลล์มือสอง ตรวจสอบโดย มพช.', 625,  100,   true),
  ('แผ่นคลุมดินชีวมวล 1 แผ่น','เยื่อธรรมชาติจากชีวมวล — ไม่ใช่พลาสติก', 25,   999,   true);
```
> `points_cost` numbers above are illustrative — derive from: 10 bales = 125 kg × 1.0 coin/kg = 125 coins for biodiesel. Executive adjusts in UI.

**Add CMU as Focal Point factory:**
```sql
alter table factories add column if not exists is_focal_point boolean not null default false;

insert into factories (name_th, location_text, lat, lng, active, is_focal_point)
values ('มหาวิทยาลัยเชียงใหม่ (มช.)', 'เชียงใหม่', 18.7883, 98.9853, true, true);
```

**Add impact_baselines table** (for KPI — data arrives from CMU later):
```sql
create table if not exists impact_baselines (
  id uuid primary key default gen_random_uuid(),
  pilot_area text not null,
  hotspot_count_baseline integer,
  co2_kg_baseline numeric(15,3),
  avg_income_baht_per_household numeric(12,2),
  recorded_by text,
  recorded_at timestamptz not null default now()
);
```

**Add value_chain_mappings table** (display only — executive dashboard):
```sql
create table if not exists value_chain_mappings (
  id uuid primary key default gen_random_uuid(),
  product_name_th text not null,
  producer_org text,
  buyer_org text,
  buyer_use_th text,
  active boolean not null default true
);

insert into value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th) values
  ('เยื่อชีวมวล (Bio-pulp)',    'มช./มก.',      'บริษัท Precise', 'ทำไม้เทียม'),
  ('ถ่านชีวภาพ/ไบโอชาร์',     'มช./วว./มก.',  'กลุ่มโรงงาน',    'ใช้ใน Boiler'),
  ('น้ำมันไพโรไลซิส',          'มช./วว.',      'วิสาหกิจชุมชน',  'พลังงานชุมชน');
```

**Migration files to create:**
| File | Content |
|---|---|
| `20260413_01_seed_units_materials.sql` | bale unit + material types |
| `20260413_02_seed_rewards.sql` | rewards catalog + point rules + fix mulch name |
| `20260413_03_focal_point.sql` | is_focal_point column + CMU seed |
| `20260413_04_impact_value_chain.sql` | impact_baselines + value_chain_mappings |
| `20260413_05_demo_d06.sql` | Demo pilot data (real farmer submissions + fulfilled rewards) |

---

### B. Backend — minimal additions

**`material_point_rules` already handles coin rates.** Executive UI already lets them edit `points_per_kg`. No new table needed.

New endpoints needed:
- `GET /executive/impact-kpis` — return baselines + current delta (hotspot, CO2, income)
- `GET /executive/value-chain` — list value_chain_mappings
- `GET/PUT /executive/factories` — include `is_focal_point` field (for CMU badge)

**`workflow_service.py` additions:**
- `get_impact_kpis()` — query impact_baselines + compute deltas
- `list_value_chain()` — simple select
- Update factory queries to include `is_focal_point`

**No changes to `request_reward_trade` DB function.** Points gate already correct.

---

### C. Frontend — minimal additions

**`ExecutiveSettings.tsx`** — already has material_point_rules editor. Verify it's exposed and working. No new UI needed for exchange rates — they ARE the point rules.

**`ExecutiveDashboard.tsx`** — add 3 new KPI stat cards:
- จุดเผา (Hotspot) ลดลง — shows 0 / "รอ Baseline จาก มช." until data arrives
- CO2 ลดลง (กก.) — same
- รายได้เฉลี่ยเกษตรกร (บาท/ครัวเรือน) — same
- Add Value Chain section (read-only table, 3 rows)

**`LogisticsTracking.tsx`** — show "Focal Point" badge on CMU destination factory.

**`FarmerRewards.tsx`** — farmer sees rewards with points_cost. Already works. No change needed if coin rates are seeded correctly.

**No farmer role/group UI needed** — farmer just submits material, earns coins automatically when factory confirms.

---

### D. Demo Script D-06 (due 26 Apr)

Seed `20260413_05_demo_d06.sql`:
- 3–5 farmer profiles with real pilot submissions (rice_straw, orchard_residue)
- Pickup jobs in various states (scheduled → delivered → confirmed)
- Factory intakes confirmed → coins credited
- 1–2 reward requests (approved + delivered) to show full loop
- Dashboard shows non-zero KPIs

Verify full flow on staging before 26 Apr.

---

## Implementation Order

```
Day 1:  Migrations A (units, materials, rewards, fix mulch, CMU focal point)
Day 2:  Backend B (impact KPI endpoint, value chain endpoint, factory is_focal_point)
Day 3:  Frontend C (dashboard KPI cards, value chain section, focal point badge)
Day 4:  Demo data seed + staging verify
Day 5:  Buffer / fixes
```

---

## Pending (Blocked — waiting on external data)

| Item | Owner | Due | Status |
|---|---|---|---|
| bale → kg exact weight | อ.จุ๊บ | Before 26 Apr | ⏳ Waiting |
| Precise buy volume (ton/value) | อ.จุ๊บ | Before 26 Apr | ⏳ Waiting |
| ศูนย์ข้าวล้านนา buy volume | อ.จุ๊บ | Before 26 Apr | ⏳ Waiting |
| Logistics costing per stage | อ.บี/นุ่น | Before 26 Apr | ⏳ Waiting |
| Hotspot & CO2 Baseline | มช./อ.แชมป์ | May 2568 | ⏳ Waiting |
| Market Size 5–10 yr | อ.โบว์/อ.จุ๊บ | Before 28 Apr | ⏳ Waiting |
| Mulch cover sheet count (sqm) | PPP Plastic | TBD | ⏳ Waiting |
| Solar Panel lot — Nakhon Pathom | อ.จุ๊บ | Late Apr | ⏳ Waiting |

---

## Big Picture: Complete AREX Flow

### Actors

| Actor | Responsibility | View |
|---|---|---|
| **เกษตรกร** | Submits material, tracks coin balance, redeems rewards | `/farmer` |
| **Logistics (WeMove)** | Picks up material from farmer, delivers to CMU Focal Point | `/logistics` |
| **Factory / CMU Focal Point** | Weighs confirmed material → triggers coin credit automatically | `/factory` |
| **Warehouse** | Approves reward redemption requests, triggers delivery | `/warehouse` |
| **Executive / บพข.** | Sets coin rates, manages catalog, views all KPIs | `/executive` |

---

### Full Flow

```
PHASE 1 — FARMER SUBMITS MATERIAL
  Farmer declares: material_type + quantity + unit + pickup location
  → material_submissions created (status: submitted)
  Farmer has NO responsibility beyond this. No group assignment needed.

PHASE 2 — LOGISTICS PICKUP (WeMove)
  Logistics sees queue → schedules pickup
  → pickup_jobs created (status: pickup_scheduled)
  Picks up → picked_up → delivers to CMU Focal Point → delivered_to_factory

PHASE 3 — FOCAL POINT / FACTORY CONFIRMS & WEIGHS
  Factory staff weighs actual material (measured_weight_kg)
  System auto-calculates:
    coins = floor(measured_kg × material_point_rules.points_per_kg)
  → factory_intakes created
  → points_ledger: intake_credit written
  → submission status: points_credited
  ★ Executive controls coin rate (points_per_kg) — change anytime in Settings

PHASE 4 — FARMER REDEEMS COINS FOR REWARD
  Farmer sees coin balance + rewards catalog (with coins_cost per reward)
  Farmer picks reward → system checks: available_coins ≥ reward.points_cost
  → reward_requests created (status: requested)
  → points_ledger: reward_reserve (holds coins)
  → rewards_catalog.stock_qty decremented

PHASE 5 — WAREHOUSE APPROVES
  Warehouse reviews → approve or reject
  Approved: reward_requests → warehouse_approved
             → logistics schedules delivery (reward_delivery_jobs)
  Rejected: reward_requests → warehouse_rejected
             → points_ledger: reward_release (coins returned)
             → stock_qty restored

PHASE 6 — LOGISTICS DELIVERS REWARD
  Logistics delivers physical reward to farmer
  → reward_delivery_jobs: reward_delivered
  → points_ledger: reward_spend (closes accounting)

PHASE 7 — EXECUTIVE DASHBOARD
  Aggregated KPIs:
    • Material collected (kg/ton) by type
    • Coins credited / reserved / spent
    • Unique farmers, submissions, pickup jobs
    • Reward redemption flow
    • [NEW] Hotspot reduction vs CMU baseline (shows 0 until May 2568)
    • [NEW] CO2 reduction (kg/ton)
    • [NEW] Avg farmer income (baht/household)
    • [NEW] Value chain: processed product → buyer
```

---

### Points (PMUC Coins) — Role Summary

| Event | Trigger | Ledger entry |
|---|---|---|
| Coins earned | Factory confirms weight | `intake_credit` |
| Coins held | Farmer requests reward | `reward_reserve` |
| Coins returned | Warehouse rejects | `reward_release` |
| Coins spent | Reward delivered | `reward_spend` |
| Manual fix | Admin correction | `adjustment` |

**Executive controls two numbers:**
1. `material_point_rules.points_per_kg` — how many coins per kg of each material
2. `rewards_catalog.points_cost` — how many coins each reward costs

Both are editable in Executive Settings. No code deploy needed to adjust rates.

---

### What Changes vs Current System

| Aspect | Current | After |
|---|---|---|
| Coin rates | Hardcoded / unseeded | Seeded per material type, editable in UI |
| Rewards catalog | Empty / wrong names | Seeded: biodiesel, solar, biomass mulch (correct name) |
| Factory destinations | Empty | CMU seeded with `is_focal_point = true` |
| KPI dashboard | Weight + points only | + Hotspot, CO2, income cards (placeholder until baseline) |
| Value chain | Not in system | Static table in Executive Dashboard |
| Farmer view | Points + redemption (works) | Same — no change needed |
| Exchange architecture | points_cost gates redemption | Same — no architecture change |
