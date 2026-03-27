# Implementation Plan: MESOB Fleet Management System

## Overview

Implement the `mesob_fleet_management` Odoo module in dependency order: security first, then model fixes, model rewrites, new models, data/config, and finally views. Each phase builds on the previous so no orphaned code is introduced.

## Tasks

- [x] 1. Security Foundation
  - [x] 1.1 Update `security/security.xml`: add `group_fleet_dispatcher` group record; configure `group_fleet_manager` to imply `group_fleet_dispatcher`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 1.2 Rewrite `security/ir.model.access.csv`: remove all no-group rows; add group-scoped rows for every model per the RBAC matrix (fleet_user R/C on trip.request; fleet_dispatcher R/W/C on trip.request and trip.assignment; fleet_manager full access on all models; read-only rows for lower groups on restricted models)
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_
  - [ ]* 1.3 Write property test for RBAC write restriction on Trip_Assignment
    - **Property 24: RBAC write restriction on Trip_Assignment**
    - **Validates: Requirements 10.6**

- [x] 2. Model Fixes — Maintenance & Service
  - [x] 2.1 Fix `models/maintenance_log.py`: change `parts_ids` One2many inverse FK from `vehicle_id` to `maintenance_log_id`; add `action_complete` side effects (set `vehicle.availability=True`, update `vehicle.current_odometer`, update `MaintenanceSchedule.last_odometer` and `last_service_date`); add `@api.constrains` for `cost >= 0`; ensure `mail.thread` inheritance and `tracking=True` on `state`, `vehicle_id`, `technician_id`, `cost`, `odometer`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 11.2_
  - [ ]* 2.2 Write property test for maintenance log done side effects
    - **Property 17: Maintenance log done side effects**
    - **Validates: Requirements 6.3, 6.4, 6.5**
  - [ ]* 2.3 Write property test for maintenance log in_progress sets vehicle unavailable
    - **Property 18: Maintenance log in_progress sets vehicle unavailable**
    - **Validates: Requirements 6.3**
  - [ ]* 2.4 Write property test for maintenance log cost validation
    - **Property 19: Maintenance log cost validation**
    - **Validates: Requirements 6.7**
  - [x] 2.5 Fix `models/service_record.py`: change `service_type` field from `Char` to `Selection` with values `[('routine','Routine'),('repair','Repair'),('inspection','Inspection'),('emergency','Emergency')]`; add `@api.constrains` for `cost >= 0`
    - _Requirements: 7.1, 7.3_
  - [ ]* 2.6 Write property test for service record cost validation
    - **Property 20: Service record cost validation**
    - **Validates: Requirements 7.3**

- [x] 3. Model Fixes — Odometer & Inventory
  - [x] 3.1 Fix `models/odometer_log.py`: add `@api.constrains('value')` that raises `ValidationError` when `value < vehicle_id.current_odometer`
    - _Requirements: 4.4, 4.5_
  - [ ]* 3.2 Write property test for odometer cannot decrease
    - **Property 14: Odometer cannot decrease**
    - **Validates: Requirements 4.5**
  - [x] 3.3 Fix `models/inventory_allocation.py`: add `maintenance_log_id = fields.Many2one('mesob.maintenance.log', ...)` optional FK; add `@api.constrains('quantity')` that raises `ValidationError` when `quantity <= 0`
    - _Requirements: 8.1, 8.2, 8.4_
  - [ ]* 3.4 Write property test for inventory allocation quantity validation
    - **Property 21: Inventory allocation quantity validation**
    - **Validates: Requirements 8.2**

- [x] 4. Model Fixes — Fuel Log & Trip Assignment
  - [x] 4.1 Fix `models/fuel_log.py`: add `driver_id = fields.Many2one('hr.employee')` and `fuel_station = fields.Char()`; add `efficiency = fields.Float(compute='_compute_efficiency', store=True)` with `@api.depends('odometer','volume','vehicle_id','date')`; implement efficiency computation (find prior log, divide distance by volume, default 0.0); add `@api.constrains` for `volume > 0` and `cost >= 0`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 4.2 Write property test for fuel efficiency computation
    - **Property 15: Fuel efficiency computation**
    - **Validates: Requirements 5.2**
  - [ ]* 4.3 Write property test for fuel log volume and cost validation
    - **Property 16: Fuel log volume and cost validation**
    - **Validates: Requirements 5.3, 5.4**
  - [x] 4.4 Fix `models/trip_assignment.py`: add `confirmed_at = fields.Datetime(readonly=True)` and `state = fields.Selection([('draft','Draft'),('confirmed','Confirmed'),('cancelled','Cancelled')])`; implement `_check_conflicts` as `@api.constrains('vehicle_id','driver_id','state')` using the overlap domain from the design; add dispatcher write guard raising `AccessError` for non-dispatcher/non-manager writes
    - _Requirements: 3.4, 3.5, 10.6_
  - [ ]* 4.5 Write property test for vehicle conflict detection (BR-2)
    - **Property 10: Vehicle conflict detection (BR-2)**
    - **Validates: Requirements 3.4**
  - [ ]* 4.6 Write property test for driver conflict detection (BR-3)
    - **Property 11: Driver conflict detection (BR-3)**
    - **Validates: Requirements 3.5**

- [ ] 5. Checkpoint — Ensure all model fix tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Trip Request Rewrite
  - [x] 6.1 Rewrite `models/trip_request.py`: define all 7 states (`draft/pending/approved/rejected/in_progress/completed/closed`); add all required fields (`requester_id`, `purpose`, `justification`, `vehicle_category_id`, `pickup_location`, `destination_location`, `start_date`, `end_date`); add all timestamp fields (`submitted_at`, `approved_at`, `rejected_at`, `started_at`, `completed_at`, `closed_at`); add `rejection_reason`; add `color` computed field using `COLOR_MAP`; inherit `mail.thread` with `tracking=True` on `state`, `vehicle_id`, `driver_id`, `start_date`, `end_date`
    - _Requirements: 1.1, 2.1, 2.3, 11.1_
  - [x] 6.2 Implement state transition methods on `mesob.trip.request`: `action_submit` (draft→pending, set `submitted_at`), `action_approve` (pending→approved, set `approved_at`, dispatcher guard), `action_reject` (pending→rejected, set `rejected_at`, store `rejection_reason`, dispatcher guard), `action_cancel` (pending→draft, clear `submitted_at`), `action_start` (approved→in_progress, set `started_at`), `action_complete` (in_progress→completed, set `completed_at`), `action_close` (completed→closed, set `closed_at`); raise `ValidationError` for any undefined transition; raise `AccessError` in approve/reject for non-dispatchers
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 3.1_
  - [x] 6.3 Add `@api.constrains('start_date','end_date')` to `mesob.trip.request` raising `ValidationError` when `start_date >= end_date`
    - _Requirements: 2.2_
  - [ ]* 6.4 Write property test for state transition records timestamp
    - **Property 1: State transition records timestamp**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
  - [ ]* 6.5 Write property test for invalid state transition raises error
    - **Property 2: Invalid state transition raises error**
    - **Validates: Requirements 1.8, 1.10**
  - [ ]* 6.6 Write property test for submit-then-cancel round trip
    - **Property 3: Submit-then-cancel round trip**
    - **Validates: Requirements 1.9**
  - [ ]* 6.7 Write property test for required fields enforced on submission
    - **Property 4: Required fields enforced on submission**
    - **Validates: Requirements 2.1**
  - [ ]* 6.8 Write property test for end date must be after start date
    - **Property 5: End date must be after start date**
    - **Validates: Requirements 2.2**
  - [ ]* 6.9 Write property test for color field maps state correctly
    - **Property 6: Color field maps state correctly**
    - **Validates: Requirements 2.3**
  - [ ]* 6.10 Write property test for dispatcher-only approve/reject
    - **Property 7: Dispatcher-only approve/reject**
    - **Validates: Requirements 3.1, 10.1**

- [x] 7. New Model — HR Employee Extension
  - [x] 7.1 Create `models/hr_employee.py`: extend `hr.employee` with `external_hr_id = fields.Char(index=True, copy=False)` and `synced_from_hr = fields.Boolean(default=False, readonly=True)`; implement `_upsert_employee(payload)` with match-on-`external_hr_id` upsert logic and `synced_from_hr=True`; implement `_cron_sync_employees()` fetching from `ir.config_parameter` key `mesob.hr_sync_url`, iterating records, calling `_upsert_employee` per record, catching and logging per-record errors without aborting
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 7.2 Write property test for HR sync upsert correctness
    - **Property 22: HR sync upsert correctness**
    - **Validates: Requirements 9.2, 9.3**
  - [ ]* 7.3 Write property test for HR sync error isolation
    - **Property 23: HR sync error isolation**
    - **Validates: Requirements 9.5**

- [x] 8. Data / Config Wiring
  - [x] 8.1 Update `data/cron.xml`: add `cron_sync_employees` record pointing to `hr.model_hr_employee` with `model._cron_sync_employees()`, interval 1 hour, active=True
    - _Requirements: 9.1_
  - [x] 8.2 Update `models/__init__.py`: add `from . import hr_employee` import
    - _Requirements: 9.1_
  - [x] 8.3 Update `__manifest__.py`: add `views/maintenance_log_views.xml` and `views/maintenance_schedule_views.xml` to the `data` list
    - _Requirements: 6.2, 6.6_

- [ ] 9. Checkpoint — Ensure all model and config tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Views — Trip Request
  - [x] 10.1 Update `views/trip_request_views.xml`: add 7-state statusbar widget; add all new fields (`justification`, `vehicle_category_id`, `pickup_location`, `destination_location`, timestamp fields, `rejection_reason`); add state-based button visibility for each transition action; add kanban view with `color="color"` attribute and state grouping
    - _Requirements: 1.1, 2.1, 2.3_
  - [x] 10.2 Add personal dashboard action (filtered `[('requester_id','=',uid)]`) and dispatcher queue action (filtered `[('state','=','pending')]` sorted by `submitted_at asc`) to `views/trip_request_views.xml`
    - _Requirements: 2.4, 3.6_

- [x] 11. Views — Trip Assignment & Fuel Log & Service Record
  - [x] 11.1 Update `views/trip_assignment_views.xml`: add `state` statusbar, `confirmed_at` field; add domain filters on vehicle and driver fields to exclude conflicting assignments
    - _Requirements: 3.2, 3.3_
  - [x] 11.2 Update `views/fuel_log_views.xml`: add `driver_id`, `fuel_station`, and `efficiency` (readonly) fields to the form and list views
    - _Requirements: 5.1, 5.2_
  - [x] 11.3 Update `views/service_record_views.xml`: change `service_type` field widget to use the Selection widget (remove any plain char input)
    - _Requirements: 7.1_

- [x] 12. Views — Maintenance Log & Schedule (new files)
  - [x] 12.1 Create `views/maintenance_log_views.xml`: form view with state statusbar buttons (`action_start`, `action_complete`, `action_cancel`), all fields including `parts_ids` One2many sublist showing `product_id`, `quantity`, and UoM, chatter widget; list view with key columns; window action and menu binding
    - _Requirements: 6.2, 6.6, 6.8, 8.4_
  - [x] 12.2 Create `views/maintenance_schedule_views.xml`: simple form view with all fields (`vehicle_id`, `interval_km`, `last_odometer`, `last_service_date`); list view; window action
    - _Requirements: 6.1_

- [x] 13. Views — Menu & Dashboard
  - [x] 13.1 Update `views/menu.xml`: add menu items for Maintenance Log and Maintenance Schedule under the appropriate fleet menu parent
    - _Requirements: 6.1, 6.2_
  - [x] 13.2 Update `views/dashboard_views.xml`: add fleet availability summary stats (count of available vs unavailable vehicles, count with `maintenance_due=True`)
    - _Requirements: 4.1, 4.3_

- [x] 14. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Phases must be executed in order: security → model fixes → trip request rewrite → new models → data/config → views
- Property tests use `hypothesis` with `@settings(max_examples=100)` and a comment `# Feature: mesob-fleet-management, Property N: ...`
- Test files live under `tests/` following the structure in the design document
