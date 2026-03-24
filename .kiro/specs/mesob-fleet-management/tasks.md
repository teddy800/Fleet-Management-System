# Implementation Plan: MESSOB Fleet Management System

## Overview

Implement the `mesob_fleet_customizations` Odoo module incrementally, starting with the module
skeleton and manifest, then each model layer, then views, security, cron, and finally property-based
tests for all 17 correctness properties using Hypothesis.

## Tasks

- [x] 1. Finalize module skeleton and manifest
  - Update `__manifest__.py` to declare all `data` files in load order:
    `security/security.xml`, `security/ir.model.access.csv`, `views/menu.xml`,
    `views/fleet_vehicle_views.xml`, `views/service_record_views.xml`,
    `views/fuel_log_views.xml`, `views/odometer_log_views.xml`,
    `views/trip_request_views.xml`, `views/trip_assignment_views.xml`,
    `views/dashboard_views.xml`, `data/cron.xml`
  - Confirm `depends` includes `fleet`, `hr`, `stock`, `mail`
  - Ensure `models/__init__.py` imports all ten model modules
  - _Requirements: 12.6_

- [x] 2. Implement `fleet_vehicle.py` — extended vehicle model
  - [x] 2.1 Add all custom fields: `driver_id` (Many2one `hr.employee`, domain active-only,
    no inline create), `availability` (Boolean, default True), `assignment_date`, `tax_expiry_date`,
    `contract_expiry_date`, `current_odometer` (Integer), `vin`, `location`, `purchase_value`,
    `residual_value`
    - _Requirements: 1.1, 2.1_
  - [x] 2.2 Add computed stored fields: `predicted_next_service` (Date), `predicted_remaining_km`
    (Integer), `maintenance_due` (Boolean), `fuel_consumption` (Float)
    - _Requirements: 5.1–5.6, 9.1–9.5_
  - [x] 2.3 Implement `_compute_predicted_fields()` using `maintenance_schedule_ids` with correct
    `@api.depends` on schedule fields and `current_odometer`; implement `_compute_maintenance_due()`
    with 7-day and 500 km thresholds
    - _Requirements: 5.1–5.6_
  - [x] 2.4 Implement `_compute_fuel_consumption()` using `fuel_log_ids.volume` and
    `fuel_log_ids.odometer`; return `0.0` when fewer than 2 logs or distance is zero
    - _Requirements: 9.1–9.5_
  - [x] 2.5 Add `@api.constrains('license_plate')` raising `ValidationError("License plate is
    required.")` for empty/whitespace values; add `@api.constrains('driver_id')` raising
    `ValidationError` when assigned employee is archived
    - _Requirements: 1.2, 2.4_
  - [x] 2.6 Inherit `hr.employee` (in same file or separate) to override `write` and auto-clear
    `driver_id` on all vehicles when employee `active` is set to `False`
    - _Requirements: 2.2_
  - [x] 2.7 Implement `action_open_stock_moves()` returning a filtered action for `stock.move`
    records linked to this vehicle; implement `_run_alert_scheduler()` and
    `_create_activity_if_absent()` for the daily cron
    - _Requirements: 6.1–6.7, 8.4_
  - [x] 2.8 Write property test for license plate constraint (Property 1)
    - **Property 1: License Plate Required**
    - **Validates: Requirements 1.2**
  - [x] 2.9 Write property test for employee archive auto-unassign (Property 2)
    - **Property 2: Employee Archive Auto-Unassigns Drivers**
    - **Validates: Requirements 2.2**
  - [x] 2.10 Write property test for archived employee assignment rejection (Property 3)
    - **Property 3: Archived Employee Cannot Be Assigned as Driver**
    - **Validates: Requirements 2.4**

- [x] 3. Implement `service_record.py` — service and cost logging
  - [x] 3.1 Add all fields: `vehicle_id` (required, `ondelete='restrict'`), `service_type`
    (selection fuel/maintenance, required), `date` (required), `cost` (Float monetary, required),
    `currency_id`, `odometer` (Integer), `description` (Text)
    - _Requirements: 3.1, 3.6_
  - [x] 3.2 Add `@api.constrains('cost')` raising `ValidationError("Cost cannot be negative.")`
    for `cost < 0`
    - _Requirements: 3.2_
  - [x] 3.3 Write property test for non-negative cost constraint (Property 4)
    - **Property 4: Service Record Cost Non-Negative**
    - **Validates: Requirements 3.2**
  - [x] 3.4 Write property test for vehicle deletion blocked by service records (Property 5)
    - **Property 5: Vehicle Deletion Blocked by Service Records**
    - **Validates: Requirements 3.6**

- [x] 4. Implement `odometer_log.py` — monotonic odometer tracking
  - [x] 4.1 Ensure all required fields are present: `vehicle_id` (required), `value` (Float,
    required), `date` (Date, required)
    - _Requirements: 4.1_
  - [x] 4.2 Fix `@api.constrains('value')` to correctly compare against the max existing value
    (excluding the current record being saved) and raise
    `ValidationError("Odometer value cannot be less than the previous reading.")`
    - _Requirements: 4.2_
  - [x] 4.3 Override `create` (and `write`) to write `vehicle_id.current_odometer = value` after
    saving, so the vehicle's `current_odometer` always reflects the latest reading
    - _Requirements: 4.3, 4.5_
  - [x] 4.4 Write property test for monotonic odometer constraint (Property 6)
    - **Property 6: Odometer Readings Are Monotonically Non-Decreasing**
    - **Validates: Requirements 4.2**
  - [x] 4.5 Write property test for odometer log updating vehicle current_odometer (Property 7)
    - **Property 7: Odometer Log Updates Vehicle's current_odometer**
    - **Validates: Requirements 4.3, 4.5**

- [-] 5. Implement `maintenance_schedule.py` and `maintenance_log.py`
  - [ ] 5.1 Add `required=True` to `vehicle_id` on `MaintenanceSchedule`; ensure all interval
    fields are present (`last_service_date`, `last_odometer`, `interval_km`, `interval_days`)
    - _Requirements: 5.1, 5.2_
  - [ ] 5.2 Complete `MaintenanceLog` fields: `vehicle_id` (required), `date`, `type`, `description`,
    `cost`, `service_provider`, `next_due_odometer`; add class docstring
    - _Requirements: 12.1_
  - [ ] 5.3 Write property test for predictive engine next service date formula (Property 8)
    - **Property 8: Predictive Engine — Next Service Date Formula**
    - **Validates: Requirements 5.1**
  - [ ] 5.4 Write property test for predictive engine remaining km formula (Property 9)
    - **Property 9: Predictive Engine — Remaining KM Formula**
    - **Validates: Requirements 5.2**
  - [ ] 5.5 Write property test for maintenance_due conditions (Property 10)
    - **Property 10: Maintenance Due Conditions**
    - **Validates: Requirements 5.3, 5.4**

- [ ] 6. Checkpoint — Ensure all model constraints and computed fields pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement `fuel_log.py` — fuel consumption trigger
  - [ ] 7.1 Add `required=True` to `vehicle_id` and `date`; add `volume` validation (> 0)
    - _Requirements: 9.1_
  - [ ] 7.2 Override `create`, `write`, and `unlink` to call
    `vehicle_id._compute_fuel_consumption()` after each mutation so `fuel_consumption` stays
    current on the parent vehicle
    - _Requirements: 9.3_
  - [ ] 7.3 Write property test for fuel consumption formula correctness (Property 15)
    - **Property 15: Fuel Consumption Formula Correctness**
    - **Validates: Requirements 9.1, 9.5**

- [ ] 8. Implement `inventory_allocation.py` — inventory integration
  - [ ] 8.1 Add `ondelete='set null'` to `vehicle_id`; add `product_id` (required), `quantity`,
    `stock_move_id` (Many2one `stock.move`, optional), `allocation_date` (Date)
    - _Requirements: 8.1, 8.3_
  - [ ] 8.2 Write property test for vehicle deletion nullifying allocation references (Property 14)
    - **Property 14: Vehicle Deletion Nullifies Inventory Allocation References**
    - **Validates: Requirements 8.3**

- [ ] 9. Implement `trip_request.py` — full state machine
  - [ ] 9.1 Add all missing fields: `purpose` (required), `start_datetime` (required),
    `end_datetime` (required), `rejection_reason` (Text), `assignment_ids`
    (One2many `mesob.trip.assignment`)
    - _Requirements: 11.1_
  - [ ] 9.2 Extend `status` selection to the full state machine:
    `draft → pending → approved/rejected → in_progress → completed → closed`
    - _Requirements: 11.2–11.7, 10.5_
  - [ ] 9.3 Implement action methods: `action_submit`, `action_approve` (with past-date warning),
    `action_reject` (records `rejection_reason`), `action_start`, `action_complete`,
    `action_close` (locks record); guard approve/reject/close with fleet manager group
    - _Requirements: 11.2–11.7_
  - [ ] 9.4 In `action_submit`, call `activity_schedule` to notify the fleet manager
    - _Requirements: 11.2_
  - [ ] 9.5 Write property test for trip request state machine transitions (Property 16)
    - **Property 16: Trip Request State Machine Transitions Are Valid**
    - **Validates: Requirements 11.2–11.7**

- [ ] 10. Implement `trip_assignment.py` and `trip_log.py`
  - [ ] 10.1 Add `required=True` to `request_id`, `vehicle_id`, `driver_id` on `TripAssignment`;
    implement `action_confirm` that checks `vehicle_id.availability` and raises
    `ValidationError` if `False`, then sets `vehicle.availability = False` and transitions
    request to `in_progress`
    - _Requirements: 11.5, 11.9_
  - [ ] 10.2 Add `required=True` to `assignment_id`, `timestamp`, `status` on `TripLog`;
    override `create` to detect `status == 'arrive'` and trigger
    `assignment_id.request_id.action_complete()` plus `vehicle.availability = True`
    - _Requirements: 11.6_
  - [ ] 10.3 Write property test for unavailable vehicle assignment rejection (Property 17)
    - **Property 17: Unavailable Vehicle Cannot Be Assigned to a Trip**
    - **Validates: Requirements 11.9**

- [ ] 11. Implement alert scheduler and cron
  - [ ] 11.1 Finalize `_run_alert_scheduler()` and `_create_activity_if_absent()` on
    `FleetVehicle` per the design pseudocode; handle maintenance due, tax expiry (30 days),
    and contract expiry (30 days)
    - _Requirements: 6.1–6.7_
  - [ ] 11.2 Create `data/cron.xml` with an `ir.cron` record calling
    `fleet.vehicle._run_alert_scheduler()` daily
    - _Requirements: 6.1_
  - [ ] 11.3 Write property test for alert scheduler creating activities (Property 11)
    - **Property 11: Alert Scheduler Creates Activities for Due Conditions**
    - **Validates: Requirements 6.2, 6.3, 6.4**
  - [ ] 11.4 Write property test for alert scheduler idempotency (Property 12)
    - **Property 12: Alert Scheduler Is Idempotent (No Duplicate Activities)**
    - **Validates: Requirements 6.6**
  - [ ] 11.5 Write property test for availability syncing with maintenance_due (Property 13)
    - **Property 13: Availability Syncs with Maintenance Due**
    - **Validates: Requirements 6.5, 6.7**

- [ ] 12. Checkpoint — Ensure scheduler and trip workflow tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement views — vehicle, service record, and dashboard
  - [ ] 13.1 Rewrite `views/fleet_vehicle_views.xml` to inherit `fleet.vehicle` form with a
    MESSOB tab containing all custom fields (`driver_id`, `availability`, `tax_expiry_date`,
    `contract_expiry_date`, `predicted_next_service`, `predicted_remaining_km`,
    `maintenance_due`, `fuel_consumption`); add related sub-lists for Service Records, Fuel Logs,
    Odometer Logs, Maintenance Schedule, Inventory Allocations; add smart button for stock moves
    - _Requirements: 1.5, 2.3, 8.2, 8.4, 10.1, 10.10_
  - [ ] 13.2 Extend inherited list view to add `driver_id`, `availability`, `tax_expiry_date`
    columns with `decoration-danger="not availability"` row decoration; extend kanban view to
    show `availability` badge grouped by `state_id`
    - _Requirements: 1.3, 1.4, 1.6_
  - [ ] 13.3 Complete `views/service_record_views.xml` with search view including filters for
    `vehicle_id`, `service_type`, date range, and group-by options
    - _Requirements: 3.4, 3.5, 10.2_
  - [ ] 13.4 Update `views/dashboard_views.xml` with three graph views (stacked bar for costs by
    service_type/month, pie for vehicles by state_id, bar for vehicles by tag_ids) and a pivot
    view; add date-range filter
    - _Requirements: 7.1–7.5_

- [ ] 14. Implement views — fuel log, odometer, trip request, trip assignment
  - [ ] 14.1 Create `views/fuel_log_views.xml` with list and form views for `mesob.fuel.log`;
    include search filters for `vehicle_id` and `date`
    - _Requirements: 10.3, 10.8_
  - [ ] 14.2 Create `views/odometer_log_views.xml` with list (ordered by date desc) and form
    views for `mesob.odometer.log`; include search filter for `vehicle_id`
    - _Requirements: 4.4, 10.4, 10.8_
  - [ ] 14.3 Create `views/trip_request_views.xml` with form view including `statusbar` widget
    on `status`, action buttons per state (Submit/Approve/Reject/Start/Complete/Close) guarded
    by group, `rejection_reason` visible only when `status = 'rejected'`; list view with
    `requester_id`, `purpose`, `start_datetime`, `status`
    - _Requirements: 10.5, 10.9, 11.3, 11.4, 11.7_
  - [ ] 14.4 Create `views/trip_assignment_views.xml` with list and form views for
    `mesob.trip.assignment`; include confirm button calling `action_confirm`
    - _Requirements: 10.6_

- [ ] 15. Implement security — groups and access control
  - [ ] 15.1 Populate `security/security.xml` with three group definitions:
    `group_fleet_manager`, `group_fleet_user`, `group_fleet_readonly` under the module category
    - _Requirements: 12.4_
  - [ ] 15.2 Populate `security/ir.model.access.csv` with three rows per custom model
    (manager: full CRUD; user: read/write/create; readonly: read only) for all nine custom models:
    `mesob.service.record`, `mesob.fuel.log`, `mesob.odometer.log`, `mesob.maintenance.schedule`,
    `mesob.maintenance.log`, `mesob.inventory.allocation`, `mesob.trip.request`,
    `mesob.trip.assignment`, `mesob.trip.log`
    - _Requirements: 12.5_

- [ ] 16. Implement menu and complete manifest data list
  - [ ] 16.1 Expand `views/menu.xml` with all menu items per the design hierarchy: Vehicles,
    Service Records, Fuel Logs, Odometer Readings, Maintenance (Schedules / Logs), Trips
    (Requests / Assignments), Inventory Allocations, Dashboard
    - _Requirements: 7.6, 10.1–10.6_
  - [ ] 16.2 Verify `__manifest__.py` `data` list matches the actual files on disk in correct
    load order (security before views, views before data)
    - _Requirements: 12.6_

- [ ] 17. Add docstrings and XML comment headers
  - [ ] 17.1 Add Python docstrings to every model class and every non-trivial method
    (`_compute_*`, `_check_*`, `_run_alert_scheduler`, `action_*`) describing purpose, inputs,
    outputs, and side effects
    - _Requirements: 12.1, 12.2_
  - [ ] 17.2 Add XML comment headers to every view file identifying file name, module, and
    description of contained views
    - _Requirements: 12.3_

- [ ] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use Hypothesis with `@settings(max_examples=100)` minimum; use 200 for
  critical properties (P6, P10, P15, P16)
- All property tests must include a comment: `# Feature: mesob-fleet-management, Property N: ...`
- Checkpoints ensure incremental validation before moving to the next layer
