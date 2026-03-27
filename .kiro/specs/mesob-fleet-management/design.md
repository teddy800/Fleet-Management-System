# Design Document: MESOB Fleet Management System

## Overview

The `mesob_fleet_management` module is an Odoo 17 application-level addon that extends the native `fleet`, `hr`, `stock`, and `mail` modules to deliver end-to-end fleet operations for the MESOB organization. It introduces ten custom models, a three-tier RBAC system, a cron-driven HR synchronization mechanism, and a dispatcher-controlled trip approval workflow.

The module follows Odoo's standard addon architecture:
- **Model inheritance**: `_inherit = 'fleet.vehicle'` to extend the native vehicle model with MESOB-specific fields.
- **New models**: All `mesob.*` models are standalone (`_name`) with `Many2one` relations back to Odoo core models.
- **Mixin inheritance**: `mail.thread` and `mail.activity.mixin` are mixed into models requiring chatter/audit trails.
- **Security**: Three `res.groups` records gate all `ir.model.access` rules; no unrestricted access rows exist.
- **Cron jobs**: Two scheduled actions — maintenance check and HR sync — run on configurable intervals.
- **HTTP controller** (optional): A JSON-RPC endpoint for the external HRMS to push employee payloads.

### Module Dependency Graph

```
base ──► hr ──► mesob_fleet_management
fleet ──►┘         │
stock ──►──────────┤
mail  ──►──────────┘
```

---

## Architecture

### Inheritance Patterns

| Pattern | Models |
|---|---|
| `_inherit` (extension) | `fleet.vehicle`, `hr.employee` |
| `_name` (new model) + `mail.thread` | `mesob.trip.request`, `mesob.maintenance.log` |
| `_name` (new model, no chatter) | All other `mesob.*` models |

### Request Flow

```
Fleet User          Dispatcher              Fleet Manager
    │                   │                       │
    ▼                   │                       │
[Submit Request]        │                       │
    │ draft→pending     │                       │
    └──────────────────►│                       │
                   [Review Queue]               │
                   [Approve/Reject]             │
                        │ pending→approved      │
                        ▼                       │
                   [Create Assignment]          │
                   [Conflict Check]             │
                        │ approved→in_progress  │
                        └──────────────────────►│
                                           [Close Trip]
                                           completed→closed
```

### Cron Architecture

Two scheduled actions are registered in `data/cron.xml`:

1. `cron_maintenance` — daily, calls `fleet.vehicle._cron_check_maintenance()`
2. `cron_sync_employees` — configurable interval, calls `hr.employee._cron_sync_employees()`

---

## Components and Interfaces

### Model Inventory

| Model | File | Inherits |
|---|---|---|
| `fleet.vehicle` (ext) | `models/fleet_vehicle.py` | `fleet.vehicle` |
| `hr.employee` (ext) | `models/hr_employee.py` | `hr.employee` |
| `mesob.trip.request` | `models/trip_request.py` | `mail.thread` |
| `mesob.trip.assignment` | `models/trip_assignment.py` | — |
| `mesob.trip.log` | `models/trip_log.py` | — |
| `mesob.fuel.log` | `models/fuel_log.py` | — |
| `mesob.service.record` | `models/service_record.py` | — |
| `mesob.maintenance.schedule` | `models/maintenance_schedule.py` | — |
| `mesob.maintenance.log` | `models/maintenance_log.py` | `mail.thread` |
| `mesob.odometer.log` | `models/odometer_log.py` | — |
| `mesob.inventory.allocation` | `models/inventory_allocation.py` | — |

### Key Interfaces

**Conflict Detection (BR-2, BR-3)**

`TripAssignment._check_conflicts()` is an `@api.constrains` method called on `create` and `write`. It queries for overlapping assignments using a date-range overlap condition:

```
existing.start_date < new.end_date AND existing.end_date > new.start_date
AND existing.state NOT IN ('rejected', 'closed', 'draft')
```

**HR Sync Interface**

`HrEmployee._cron_sync_employees()` fetches a JSON payload from the configured external HRMS URL (stored in `ir.config_parameter`), iterates records, and calls `_upsert_employee(payload)` per record. Errors are caught per-record and logged via `_logger.error(...)` without aborting the batch.

---

## Data Models

### `fleet.vehicle` (extension)

| Field | Type | Notes |
|---|---|---|
| `availability` | `Boolean` | default=True; set False when maintenance_due or in maintenance |
| `current_odometer` | `Float` | updated by MaintenanceLog.action_complete and OdometerLog |
| `maintenance_due` | `Boolean` | computed, stored; depends on `current_odometer` |

Computed logic:
```python
schedule = search([('vehicle_id','=',rec.id)], limit=1)
rec.maintenance_due = schedule and (
    rec.current_odometer >= schedule.last_odometer + schedule.interval_km
)
```

### `hr.employee` (extension)

| Field | Type | Notes |
|---|---|---|
| `external_hr_id` | `Char` | unique external HRMS identifier; indexed |
| `synced_from_hr` | `Boolean` | default=False; set True by HR Sync |

### `mesob.trip.request`

| Field | Type | Notes |
|---|---|---|
| `name` | `Char` | sequence-generated reference, readonly |
| `requester_id` | `Many2one('res.users')` | required; default=env.user |
| `purpose` | `Text` | required |
| `justification` | `Text` | required |
| `vehicle_category_id` | `Many2one('fleet.vehicle.tag')` | preferred category |
| `pickup_location` | `Char` | required |
| `destination_location` | `Char` | required |
| `start_date` | `Datetime` | required |
| `end_date` | `Datetime` | required |
| `vehicle_id` | `Many2one('fleet.vehicle')` | assigned after approval |
| `driver_id` | `Many2one('hr.employee')` | assigned after approval |
| `state` | `Selection` | draft/pending/approved/rejected/in_progress/completed/closed |
| `submitted_at` | `Datetime` | readonly |
| `approved_at` | `Datetime` | readonly |
| `rejected_at` | `Datetime` | readonly |
| `rejection_reason` | `Text` | set on rejection |
| `started_at` | `Datetime` | readonly |
| `completed_at` | `Datetime` | readonly |
| `closed_at` | `Datetime` | readonly |
| `color` | `Integer` | computed from state for kanban |

Color mapping:
```
draft=0 (grey), pending=1 (blue), approved=10 (green),
rejected=9 (red), in_progress=3 (orange), completed=4 (teal), closed=8 (dark grey)
```

### `mesob.trip.assignment`

| Field | Type | Notes |
|---|---|---|
| `trip_id` | `Many2one('mesob.trip.request')` | required |
| `vehicle_id` | `Many2one('fleet.vehicle')` | required |
| `driver_id` | `Many2one('hr.employee')` | required |
| `confirmed_at` | `Datetime` | set on confirm action |
| `state` | `Selection` | draft/confirmed/cancelled |

Constraint `_check_conflicts` fires on create/write when state=confirmed.

### `mesob.trip.log`

| Field | Type | Notes |
|---|---|---|
| `trip_id` | `Many2one('mesob.trip.request')` | required |
| `start_odometer` | `Float` | |
| `end_odometer` | `Float` | |

### `mesob.fuel.log`

| Field | Type | Notes |
|---|---|---|
| `vehicle_id` | `Many2one('fleet.vehicle')` | required |
| `driver_id` | `Many2one('hr.employee')` | |
| `date` | `Date` | required |
| `fuel_station` | `Char` | |
| `volume` | `Float` | liters; must be > 0 |
| `cost` | `Float` | must be >= 0 |
| `odometer` | `Float` | reading at refuel time |
| `efficiency` | `Float` | computed, stored; KM/L |

Efficiency computation:
```python
prev = search([('vehicle_id','=',rec.vehicle_id.id),
               ('date','<',rec.date),
               ('id','!=',rec.id)],
              order='date desc, id desc', limit=1)
rec.efficiency = (rec.odometer - prev.odometer) / rec.volume if prev else 0.0
```

### `mesob.service.record`

| Field | Type | Notes |
|---|---|---|
| `vehicle_id` | `Many2one('fleet.vehicle')` | required |
| `date` | `Date` | |
| `cost` | `Float` | must be >= 0 |
| `description` | `Text` | |
| `service_type` | `Selection` | routine/repair/inspection/emergency |
| `fuel_volume` | `Float` | |
| `odometer` | `Float` | |

### `mesob.maintenance.schedule`

| Field | Type | Notes |
|---|---|---|
| `vehicle_id` | `Many2one('fleet.vehicle')` | required |
| `interval_km` | `Float` | km between services |
| `last_odometer` | `Float` | odometer at last service |
| `last_service_date` | `Date` | date of last service |

### `mesob.maintenance.log`

| Field | Type | Notes |
|---|---|---|
| `vehicle_id` | `Many2one('fleet.vehicle')` | required, tracking=True |
| `technician_id` | `Many2one('hr.employee')` | tracking=True |
| `service_record_id` | `Many2one('mesob.service.record')` | optional link |
| `date` | `Date` | required |
| `description` | `Text` | |
| `maintenance_type` | `Selection` | preventive/corrective/emergency |
| `cost` | `Float` | must be >= 0; tracking=True |
| `currency_id` | `Many2one('res.currency')` | default=company currency |
| `odometer` | `Float` | required; tracking=True |
| `parts_ids` | `One2many('mesob.inventory.allocation','maintenance_log_id')` | |
| `state` | `Selection` | draft/in_progress/done/cancel; tracking=True |

`action_complete` must additionally call:
```python
schedule = env['mesob.maintenance.schedule'].search([('vehicle_id','=',rec.vehicle_id.id)], limit=1)
if schedule:
    schedule.last_odometer = rec.odometer
    schedule.last_service_date = rec.date
```

### `mesob.odometer.log`

| Field | Type | Notes |
|---|---|---|
| `vehicle_id` | `Many2one('fleet.vehicle')` | required |
| `date` | `Date` | required |
| `value` | `Float` | must be >= vehicle's current_odometer |

Constraint: `value >= vehicle_id.current_odometer` (no decreasing readings).

### `mesob.inventory.allocation`

| Field | Type | Notes |
|---|---|---|
| `vehicle_id` | `Many2one('fleet.vehicle')` | required |
| `product_id` | `Many2one('product.product')` | required |
| `quantity` | `Float` | must be > 0 |
| `maintenance_log_id` | `Many2one('mesob.maintenance.log')` | optional FK |

---

## Workflow Design

### TripRequest State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
         submit()   │  approve()        reject()             │
[draft] ──────────► [pending] ──────► [approved]  [rejected] │
   ▲                    │                  │                  │
   │   cancel()         │                  │ confirm_assign() │
   └────────────────────┘                  ▼                  │
                                      [in_progress]           │
                                           │                  │
                                  mark_complete()             │
                                           ▼                  │
                                      [completed]             │
                                           │                  │
                                    close()                   │
                                           ▼                  │
                                       [closed] ──────────────┘
```

Allowed transitions:
- `draft` → `pending` (submit, Fleet User)
- `pending` → `approved` (approve, Dispatcher)
- `pending` → `rejected` (reject, Dispatcher)
- `pending` → `draft` (cancel, Fleet User — clears submitted_at)
- `approved` → `in_progress` (confirm assignment, Dispatcher)
- `in_progress` → `completed` (Fleet User or Fleet Manager)
- `completed` → `closed` (Fleet Manager)

Any other transition raises `ValidationError`.

### MaintenanceLog State Machine

```
[draft] ──action_start()──► [in_progress] ──action_complete()──► [done]
   │                              │
   └──action_cancel()──► [cancel] ┘ (cancel also allowed from in_progress)
```

Side effects:
- `in_progress`: `vehicle.availability = False`
- `done`: `vehicle.availability = True`, update `vehicle.current_odometer`, update `MaintenanceSchedule`

---

## Business Logic

### BR-1: Dispatcher-Only Approval

`action_approve` and `action_reject` on `mesob.trip.request` check group membership at the start of the method:

```python
if not self.env.user.has_group('mesob_fleet_management.group_fleet_dispatcher'):
    raise AccessError(_("Only dispatchers can approve or reject trip requests."))
```

### BR-2 & BR-3: Conflict Detection Algorithm

`mesob.trip.assignment._check_conflicts()` is decorated with `@api.constrains('vehicle_id','driver_id','state')`.

```python
@api.constrains('vehicle_id', 'driver_id', 'state')
def _check_conflicts(self):
    for rec in self:
        if rec.state != 'confirmed':
            continue
        trip = rec.trip_id
        overlap_domain = [
            ('state', 'not in', ['rejected', 'closed', 'draft', 'cancelled']),
            ('id', '!=', rec.id),
            ('trip_id.start_date', '<', trip.end_date),
            ('trip_id.end_date', '>', trip.start_date),
        ]
        # BR-2: vehicle conflict
        vehicle_conflict = self.search(overlap_domain + [('vehicle_id','=',rec.vehicle_id.id)])
        if vehicle_conflict:
            raise ValidationError(_("Vehicle %s is already assigned during this period.") % rec.vehicle_id.name)
        # BR-3: driver conflict
        driver_conflict = self.search(overlap_domain + [('driver_id','=',rec.driver_id.id)])
        if driver_conflict:
            raise ValidationError(_("Driver %s is already assigned during this period.") % rec.driver_id.name)
```

### Fuel Efficiency Calculation

Triggered by `@api.depends('odometer','volume','vehicle_id','date')` on `mesob.fuel.log`:

```python
prev = self.search([
    ('vehicle_id','=',rec.vehicle_id.id),
    ('date','<=',rec.date),
    ('id','!=',rec._origin.id)
], order='date desc, id desc', limit=1)
if prev and rec.volume > 0:
    rec.efficiency = (rec.odometer - prev.odometer) / rec.volume
else:
    rec.efficiency = 0.0
```

### Maintenance Due Computation

Already implemented in `fleet_vehicle.py`. Triggered by `@api.depends('current_odometer')`. Searches for the vehicle's `mesob.maintenance.schedule` and compares `current_odometer >= last_odometer + interval_km`.

---

## Security Design

### Groups

Defined in `security/security.xml`:

```xml
group_fleet_user       → Fleet User
group_fleet_dispatcher → Fleet Dispatcher  (implied by group_fleet_manager)
group_fleet_manager    → Fleet Manager
```

`group_fleet_manager` should imply `group_fleet_dispatcher` so managers inherit all dispatcher permissions.

### RBAC Matrix

`R=read, W=write, C=create, D=delete`

| Model | fleet_user | fleet_dispatcher | fleet_manager |
|---|---|---|---|
| `mesob.trip.request` | R,C | R,W,C | R,W,C,D |
| `mesob.trip.assignment` | R | R,W,C | R,W,C,D |
| `mesob.trip.log` | R | R,W,C | R,W,C,D |
| `fleet.vehicle` (mesob ext) | R | R | R,W,C,D |
| `mesob.fuel.log` | R | R | R,W,C,D |
| `mesob.service.record` | R | R | R,W,C,D |
| `mesob.maintenance.schedule` | R | R | R,W,C,D |
| `mesob.maintenance.log` | R | R | R,W,C,D |
| `mesob.odometer.log` | R | R | R,W,C,D |
| `mesob.inventory.allocation` | R | R | R,W,C,D |
| `hr.employee` (mesob ext) | R | R | R,W,C |

All existing no-group rows in `ir.model.access.csv` must be removed and replaced with the above group-scoped rows.

---

## HR Sync Design

### New File: `models/hr_employee.py`

Extends `hr.employee` with two fields and the sync cron method.

### Fields Added

```python
external_hr_id = fields.Char(string="External HR ID", index=True, copy=False)
synced_from_hr = fields.Boolean(string="Synced from HR", default=False, readonly=True)
```

### Upsert Logic

```python
def _upsert_employee(self, payload: dict):
    ext_id = payload.get('external_hr_id')
    if not ext_id:
        raise ValueError("Missing external_hr_id")
    existing = self.search([('external_hr_id','=',ext_id)], limit=1)
    vals = {
        'name': payload['name'],
        'work_email': payload.get('email',''),
        'external_hr_id': ext_id,
        'synced_from_hr': True,
    }
    if existing:
        existing.write(vals)
    else:
        self.create(vals)
```

### Cron Method

```python
def _cron_sync_employees(self):
    url = self.env['ir.config_parameter'].sudo().get_param('mesob.hr_sync_url')
    if not url:
        _logger.warning("mesob.hr_sync_url not configured; skipping HR sync.")
        return
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        records = response.json()
    except Exception as e:
        _logger.error("HR Sync fetch failed: %s", e)
        return
    for payload in records:
        try:
            self._upsert_employee(payload)
        except Exception as e:
            _logger.error("HR Sync skipped record %s: %s", payload, e)
```

### Cron Registration (`data/cron.xml` addition)

```xml
<record id="cron_sync_employees" model="ir.cron">
    <field name="name">HR Employee Sync</field>
    <field name="model_id" ref="hr.model_hr_employee"/>
    <field name="state">code</field>
    <field name="code">model._cron_sync_employees()</field>
    <field name="interval_number">1</field>
    <field name="interval_type">hours</field>
    <field name="active">True</field>
</record>
```

---

## Inventory-Fleet Integration

`mesob.inventory.allocation` bridges `stock` (product catalog) and `fleet` (vehicle assets).

### Relationship Diagram

```
fleet.vehicle ◄──── mesob.inventory.allocation ────► product.product
                              │
                              ▼
                    mesob.maintenance.log (optional FK)
```

### Key Design Points

- `maintenance_log_id` is optional (`required=False`); allocations can exist independently of a maintenance job (e.g., stocked spares assigned to a vehicle).
- The `parts_ids` One2many on `MaintenanceLog` uses `maintenance_log_id` as the inverse FK (not `vehicle_id` as currently coded — this is a bug to fix).
- `quantity` must be > 0 enforced by `@api.constrains`.
- Users with `stock` module access can create allocations from the Inventory menu; the module's `ir.model.access` rules grant `group_fleet_manager` full access and `group_fleet_user`/`group_fleet_dispatcher` read access.

---

## View Architecture

### Views to Create / Update

| View File | Status | Changes Needed |
|---|---|---|
| `views/trip_request_views.xml` | Update | Add all new fields, 7-state statusbar, kanban with color, personal dashboard action, dispatcher queue action |
| `views/trip_assignment_views.xml` | Update | Add `confirmed_at`, `state`, conflict-filtered domain on vehicle/driver |
| `views/fleet_vehicle_views.xml` | Update | Add `availability`, `current_odometer`, `maintenance_due` to form |
| `views/fuel_log_views.xml` | Update | Add `driver_id`, `fuel_station`, `efficiency` fields |
| `views/service_record_views.xml` | Update | Change `service_type` to Selection widget |
| `views/odometer_log_views.xml` | Update | Minimal; already has correct fields |
| `views/maintenance_log_views.xml` | **Create** | Full form with state buttons, parts_ids sublist, chatter |
| `views/maintenance_schedule_views.xml` | **Create** | Simple form/list |
| `views/dashboard_views.xml` | Update | Add fleet availability calendar/timeline |
| `views/menu.xml` | Update | Add Maintenance Log and Maintenance Schedule menu items |

### TripRequest Kanban Color Widget

The `color` integer field maps to Odoo's standard kanban color palette. The `color` field is computed:

```python
COLOR_MAP = {
    'draft': 0, 'pending': 1, 'approved': 10,
    'rejected': 9, 'in_progress': 3, 'completed': 4, 'closed': 8
}
```

In the kanban view, add `color="color"` on the `<kanban>` tag.

---

## Implementation Plan

Dependencies must be respected: security before models, models before views, base models before dependent models.

### Phase 1 — Security Foundation
1. Update `security/security.xml`: add `group_fleet_dispatcher`, set `group_fleet_manager` to imply `group_fleet_dispatcher`
2. Rewrite `security/ir.model.access.csv`: remove all no-group rows, add group-scoped rows per RBAC matrix

### Phase 2 — Model Fixes (no new files)
3. `models/fleet_vehicle.py` — no changes needed (already correct)
4. `models/maintenance_log.py` — fix `parts_ids` inverse FK from `vehicle_id` to `maintenance_log_id`; add `action_complete` schedule update
5. `models/service_record.py` — change `service_type` from `Char` to `Selection`; add cost constraint
6. `models/odometer_log.py` — add decreasing-value constraint
7. `models/inventory_allocation.py` — add `maintenance_log_id` FK; add quantity > 0 constraint
8. `models/fuel_log.py` — add `driver_id`, `fuel_station`, `efficiency` computed field, volume/cost constraints
9. `models/trip_assignment.py` — add `confirmed_at`, `state`, `_check_conflicts` constrains method, dispatcher write guard

### Phase 3 — Model Rewrites
10. `models/trip_request.py` — full rewrite: 7 states, all timestamp fields, all required fields, `mail.thread`, color computed field, RBAC guards on approve/reject

### Phase 4 — New Models
11. `models/hr_employee.py` — new file: `external_hr_id`, `synced_from_hr`, `_cron_sync_employees`, `_upsert_employee`

### Phase 5 — Data / Config
12. `data/cron.xml` — add `cron_sync_employees` record
13. `__manifest__.py` — add `hr_employee.py` to models, add `maintenance_log_views.xml` and `maintenance_schedule_views.xml` to data list

### Phase 6 — Views
14. Update `views/trip_request_views.xml` — 7-state statusbar, all fields, kanban, personal dashboard, dispatcher queue
15. Update `views/trip_assignment_views.xml` — state, confirmed_at, filtered domains
16. Create `views/maintenance_log_views.xml` — full form, state buttons, parts sublist, chatter
17. Create `views/maintenance_schedule_views.xml` — simple form/list
18. Update `views/fuel_log_views.xml` — driver_id, fuel_station, efficiency
19. Update `views/service_record_views.xml` — service_type Selection widget
20. Update `views/menu.xml` — add Maintenance Log and Schedule menu items
21. Update `views/dashboard_views.xml` — fleet availability calendar


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: State transition records timestamp

*For any* Trip_Request in a valid source state, executing the corresponding transition action (submit, approve, reject, confirm_assignment, mark_complete, close) should result in the expected target state AND the corresponding timestamp field (submitted_at, approved_at, rejected_at, started_at, completed_at, closed_at) being set to a non-null datetime value.

**Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Invalid state transition raises error

*For any* Trip_Request and any transition that is not defined in the workflow (including cancelling a non-pending request), the system should raise a ValidationError and leave the state unchanged.

**Validates: Requirements 1.8, 1.10**

### Property 3: Submit-then-cancel round trip

*For any* Trip_Request in draft state, submitting it (draft→pending) and then cancelling it (pending→draft) should return the record to draft state with submitted_at cleared to False/None.

**Validates: Requirements 1.9**

### Property 4: Required fields enforced on submission

*For any* Trip_Request missing any one of the required fields (purpose, justification, vehicle_category_id, pickup_location, destination_location, start_date, end_date), calling submit() should raise a ValidationError.

**Validates: Requirements 2.1**

### Property 5: End date must be after start date

*For any* pair of datetimes where start_date >= end_date, setting those values on a Trip_Request and saving should raise a ValidationError.

**Validates: Requirements 2.2**

### Property 6: Color field maps state correctly

*For any* Trip_Request, the `color` computed field value should equal the expected integer from the COLOR_MAP for the record's current state (draft=0, pending=1, approved=10, rejected=9, in_progress=3, completed=4, closed=8).

**Validates: Requirements 2.3**

### Property 7: Dispatcher-only approve/reject

*For any* user NOT in group_fleet_dispatcher, calling action_approve or action_reject on a Trip_Request should raise an AccessError.

**Validates: Requirements 3.1, 10.1**

### Property 8: Vehicle availability domain filter

*For any* Trip_Request with a given vehicle_category_id and date range, the set of vehicles eligible for assignment should contain only vehicles where availability=True, category matches, and no confirmed TripAssignment overlaps the date range.

**Validates: Requirements 3.2**

### Property 9: Driver availability domain filter

*For any* Trip_Request with a given date range, the set of drivers eligible for assignment should contain only active hr.employee records with no confirmed TripAssignment overlapping the date range.

**Validates: Requirements 3.3**

### Property 10: Vehicle conflict detection (BR-2)

*For any* two Trip_Assignments that share the same vehicle_id and have overlapping date ranges (start_date < other.end_date AND end_date > other.start_date), confirming the second assignment should raise a ValidationError.

**Validates: Requirements 3.4**

### Property 11: Driver conflict detection (BR-3)

*For any* two Trip_Assignments that share the same driver_id and have overlapping date ranges, confirming the second assignment should raise a ValidationError.

**Validates: Requirements 3.5**

### Property 12: Maintenance due computation

*For any* Vehicle with an associated Maintenance_Schedule, the maintenance_due field should equal True if and only if current_odometer >= last_odometer + interval_km, and False otherwise.

**Validates: Requirements 4.2**

### Property 13: Cron sets availability False for due vehicles

*For any* set of vehicles, after running _cron_check_maintenance, every vehicle where maintenance_due=True should have availability=False, and vehicles where maintenance_due=False should retain their previous availability value.

**Validates: Requirements 4.3**

### Property 14: Odometer cannot decrease

*For any* Vehicle and any float value less than the vehicle's current_odometer, attempting to create an OdometerLog with that value should raise a ValidationError.

**Validates: Requirements 4.5**

### Property 15: Fuel efficiency computation

*For any* Fuel_Log record with a prior Fuel_Log for the same vehicle, the efficiency field should equal (odometer - prior.odometer) / volume. For the first Fuel_Log for a vehicle (no prior record), efficiency should equal 0.0.

**Validates: Requirements 5.2**

### Property 16: Fuel log volume and cost validation

*For any* Fuel_Log where volume <= 0 or cost < 0, saving the record should raise a ValidationError.

**Validates: Requirements 5.3, 5.4**

### Property 17: Maintenance log done side effects

*For any* Maintenance_Log transitioning to done state, the associated vehicle's availability should be set to True, vehicle's current_odometer should equal the log's odometer value, and the associated Maintenance_Schedule's last_odometer and last_service_date should be updated to match the log's odometer and date.

**Validates: Requirements 6.3, 6.4, 6.5**

### Property 18: Maintenance log in_progress sets vehicle unavailable

*For any* Maintenance_Log transitioning to in_progress state, the associated vehicle's availability should be set to False.

**Validates: Requirements 6.3**

### Property 19: Maintenance log cost validation

*For any* Maintenance_Log where cost < 0, saving the record should raise a ValidationError.

**Validates: Requirements 6.7**

### Property 20: Service record cost validation

*For any* Service_Record where cost < 0, saving the record should raise a ValidationError.

**Validates: Requirements 7.3**

### Property 21: Inventory allocation quantity validation

*For any* Inventory_Allocation where quantity <= 0, saving the record should raise a ValidationError.

**Validates: Requirements 8.2**

### Property 22: HR sync upsert correctness

*For any* employee payload with a valid external_hr_id, after calling _upsert_employee: an hr.employee record with that external_hr_id should exist in the system, its name and email should match the payload, and synced_from_hr should be True. If a record with that external_hr_id already existed, no duplicate should be created.

**Validates: Requirements 9.2, 9.3**

### Property 23: HR sync error isolation

*For any* batch of employee payloads containing some malformed records (missing external_hr_id or required fields), _cron_sync_employees should successfully process all valid records and not raise an unhandled exception, while logging errors for the malformed ones.

**Validates: Requirements 9.5**

### Property 24: RBAC write restriction on Trip_Assignment

*For any* user in group_fleet_user (not dispatcher or manager), attempting to write to a Trip_Assignment record should raise an AccessError.

**Validates: Requirements 10.6**

---

## Error Handling

### Validation Errors (user-facing)

All `@api.constrains` and state-guard checks raise `odoo.exceptions.ValidationError` with a descriptive message. These surface as dialog boxes in the Odoo UI.

| Condition | Error Message |
|---|---|
| start_date >= end_date | "End date must be after start date." |
| Odometer log value < current odometer | "Odometer reading cannot be less than the vehicle's current odometer." |
| Fuel log volume <= 0 | "Fuel volume must be greater than zero." |
| Fuel log cost < 0 | "Fuel cost cannot be negative." |
| Maintenance log cost < 0 | "Maintenance cost cannot be negative." |
| Service record cost < 0 | "Service cost cannot be negative." |
| Inventory allocation quantity <= 0 | "Quantity must be greater than zero." |
| Invalid state transition | "Cannot transition from {state} using this action." |
| Cancel non-pending request | "Only pending requests can be cancelled." |
| Vehicle conflict (BR-2) | "Vehicle {name} is already assigned during this period." |
| Driver conflict (BR-3) | "Driver {name} is already assigned during this period." |

### Access Errors (security-facing)

`odoo.exceptions.AccessError` is raised by:
- `action_approve` / `action_reject` called by non-dispatcher
- Write on `mesob.trip.assignment` by non-dispatcher/non-manager (enforced via `ir.model.access`)
- Create on `hr.employee` by fleet_user or fleet_dispatcher

### HR Sync Errors (server-side)

All errors in `_cron_sync_employees` are caught per-record and logged via Python's standard `logging` module at `ERROR` level. The sync continues to the next record. Network-level failures (fetch error) are logged and the entire sync is skipped gracefully.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests cover specific examples, integration points, and edge cases.
- Property-based tests verify universal correctness across randomized inputs.

### Property-Based Testing

**Library**: `hypothesis` (Python) — the standard PBT library for Python/Odoo environments.

**Configuration**: Each property test must run a minimum of 100 examples (`@settings(max_examples=100)`).

**Tag format**: Each test must include a comment referencing the design property:
```
# Feature: mesob-fleet-management, Property {N}: {property_text}
```

**One test per property**: Each of the 24 correctness properties above maps to exactly one property-based test function.

**Example property test structure**:
```python
from hypothesis import given, settings, strategies as st

@given(
    odometer_value=st.floats(min_value=0, max_value=999999),
    interval_km=st.floats(min_value=1, max_value=100000),
    last_odometer=st.floats(min_value=0, max_value=999999),
)
@settings(max_examples=100)
def test_maintenance_due_computation(odometer_value, interval_km, last_odometer):
    # Feature: mesob-fleet-management, Property 12: Maintenance due computation
    expected = odometer_value >= last_odometer + interval_km
    # ... set up vehicle and schedule, assert maintenance_due == expected
```

### Unit Tests

Unit tests focus on:
- Specific workflow examples (e.g., full trip lifecycle from draft to closed)
- Integration between models (e.g., MaintenanceLog.action_complete updates both vehicle and schedule)
- Edge cases: first fuel log (no prior → efficiency=0.0), vehicle with no maintenance schedule (maintenance_due=False)
- Error conditions with specific known-bad inputs

**Avoid** writing unit tests that duplicate what property tests already cover (e.g., don't write 7 separate unit tests for each state transition when Property 1 covers all of them).

### Test File Structure

```
tests/
  __init__.py
  test_trip_request.py        # Properties 1-6
  test_trip_assignment.py     # Properties 7-11
  test_vehicle.py             # Properties 12-14
  test_fuel_log.py            # Properties 15-16
  test_maintenance.py         # Properties 17-19
  test_service_record.py      # Property 20
  test_inventory_allocation.py # Property 21
  test_hr_sync.py             # Properties 22-23
  test_rbac.py                # Properties 7, 24
```
