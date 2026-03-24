# Requirements Document

## Introduction

The MESSOB Fleet Management System is a custom Odoo module (`mesob_fleet_customizations`) that extends
Odoo's native `fleet.vehicle` model. It provides comprehensive vehicle tracking, fuel and maintenance
cost logging, a predictive maintenance engine, automated alerts, HR-sourced driver assignment,
Inventory module integration, and rich dashboard/reporting capabilities. The module targets Odoo 16/17
and depends on the `fleet`, `hr`, `stock`, and `mail` core modules.

---

## Glossary

- **System**: The `mesob_fleet_customizations` Odoo module as a whole.
- **Fleet_Module**: The Odoo native `fleet` module and its `fleet.vehicle` model.
- **Vehicle**: A record in `fleet.vehicle` extended by this module.
- **Driver**: An `hr.employee` record assigned to a Vehicle.
- **HR_Module**: Odoo's native `hr` module and its `hr.employee` model.
- **Inventory_Module**: Odoo's native `stock` module.
- **Service_Record**: A record in `mesob.service.record` capturing a single fuel or maintenance event.
- **Odometer_Reading**: A record in `mesob.odometer.log` capturing a timestamped mileage value.
- **Maintenance_Schedule**: A record in `mesob.maintenance.schedule` defining service intervals for a Vehicle.
- **Maintenance_Log**: A record in `mesob.maintenance.log` capturing a completed maintenance event.
- **Fuel_Log**: A record in `mesob.fuel.log` capturing a single fuel fill-up event.
- **Trip_Request**: A record in `mesob.trip.request` representing a staff request for vehicle use.
- **Trip_Assignment**: A record in `mesob.trip.assignment` linking a Trip_Request to a Vehicle and Driver.
- **Trip_Log**: A record in `mesob.trip.log` capturing departure/arrival timestamps for a Trip_Assignment.
- **Inventory_Allocation**: A record in `mesob.inventory.allocation` linking a stock product to a Vehicle.
- **Predictive_Engine**: The computed logic that derives `predicted_next_service` and `predicted_remaining_km` on a Vehicle.
- **Alert_Scheduler**: The daily scheduled action (`ir.cron`) that creates Odoo activities for maintenance, tax, and contract expiry.
- **Dashboard**: The graph/pivot views rendered from `mesob.service.record` aggregations.
- **Availability**: The boolean field `availability` on a Vehicle indicating whether it is available for assignment.
- **Maintenance_Due**: The computed boolean field `maintenance_due` on a Vehicle.

---

## Requirements

### Requirement 1: Vehicle Record Management

**User Story:** As a fleet manager, I want to store and validate complete vehicle information, so that I can maintain an accurate and searchable registry of all fleet assets.

#### Acceptance Criteria

1. THE System SHALL store the following fields on each Vehicle: `license_plate`, `vehicle model` (via `fleet.vehicle.model`), `driver_id` (Many2one to `hr.employee`), `tag_ids` (vehicle category), `assignment_date`, `tax_expiry_date`, `contract_expiry_date`, `current_odometer`, `availability`, and `state_id`.
2. WHEN a Vehicle record is saved with an empty `license_plate`, THE System SHALL raise a `ValidationError` with the message "License plate is required."
3. THE System SHALL display Vehicles in a Kanban view grouped by `state_id` by default, with a secondary grouping option by `tag_ids`.
4. THE System SHALL display Vehicles in a list view with columns: `license_plate`, `model_id`, `driver_id`, `state_id`, `availability`, `tax_expiry_date`.
5. THE System SHALL display a form view for each Vehicle that includes all fields listed in criterion 1, plus `predicted_next_service`, `predicted_remaining_km`, `maintenance_due`, `fuel_consumption`, and a tab for related Service_Records.
6. WHEN a Vehicle's `availability` field is `False`, THE System SHALL display the Vehicle with a visual indicator (e.g., red status badge) in list and Kanban views.

---

### Requirement 2: Driver Assignment via HR Integration

**User Story:** As a fleet manager, I want drivers to be sourced exclusively from the HR module, so that driver records remain consistent with employee data and no duplicate personnel records are created.

#### Acceptance Criteria

1. THE System SHALL restrict the `driver_id` field on Vehicle to records from `hr.employee` only, with no option to create a new employee inline from the Vehicle form.
2. WHEN an `hr.employee` record is archived (i.e., `active` is set to `False`), THE System SHALL set `driver_id` to `False` on all Vehicles where that employee is the assigned Driver.
3. THE System SHALL display the Driver's `name`, `job_title`, and `work_phone` (sourced from `hr.employee`) as read-only related fields on the Vehicle form view.
4. IF a user attempts to assign an archived `hr.employee` as a Driver, THEN THE System SHALL raise a `ValidationError` preventing the assignment.
5. THE System SHALL provide a search filter on the Vehicle list view to find Vehicles by Driver name.

---

### Requirement 3: Service and Cost Logging

**User Story:** As a fleet manager, I want to log every fuel and maintenance event with its cost, so that I can track total operating expenses per vehicle over time.

#### Acceptance Criteria

1. THE System SHALL store the following fields on each Service_Record: `vehicle_id` (required, Many2one to `fleet.vehicle`), `service_type` (selection: `fuel` or `maintenance`, required), `date` (required), `cost` (required, monetary), `currency_id` (Many2one to `res.currency`), `odometer` (integer, odometer reading at time of service), `description` (text).
2. WHEN a Service_Record is saved with a `cost` value less than zero, THE System SHALL raise a `ValidationError` with the message "Cost cannot be negative."
3. THE System SHALL compute and display the aggregate total cost of all Service_Records per Vehicle per calendar month on the Vehicle form view.
4. THE System SHALL allow filtering Service_Records by `vehicle_id`, `service_type`, and `date` range in the list view.
5. THE System SHALL allow grouping Service_Records by `vehicle_id` and `service_type` in the list view.
6. FOR ALL Service_Records of a given Vehicle, THE System SHALL preserve the records when the Vehicle is deleted by raising a `ValidationError` or by using `ondelete='restrict'` on the `vehicle_id` field.

---

### Requirement 4: Odometer Tracking

**User Story:** As a fleet manager, I want a time-ordered log of odometer readings per vehicle, so that I can track mileage accurately and detect data entry errors.

#### Acceptance Criteria

1. THE System SHALL store the following fields on each Odometer_Reading: `vehicle_id` (required, Many2one to `fleet.vehicle`), `value` (required, float, in kilometres), `date` (required, date).
2. WHEN an Odometer_Reading is saved with a `value` less than the highest existing `value` for the same Vehicle, THE System SHALL raise a `ValidationError` with the message "Odometer value cannot be less than the previous reading."
3. THE System SHALL display the most recent Odometer_Reading `value` for a Vehicle as the `current_odometer` field on the Vehicle form view.
4. THE System SHALL order Odometer_Readings by `date` descending in the related list on the Vehicle form view.
5. WHEN a new Odometer_Reading is saved, THE System SHALL update the `current_odometer` field on the associated Vehicle to the new `value`.

---

### Requirement 5: Predictive Maintenance Engine

**User Story:** As a fleet manager, I want the system to predict the next service date and remaining kilometres for each vehicle, so that I can schedule maintenance proactively and avoid breakdowns.

#### Acceptance Criteria

1. WHEN a Maintenance_Schedule record exists for a Vehicle, THE Predictive_Engine SHALL compute `predicted_next_service` as `last_service_date` + `interval_days`.
2. WHEN a Maintenance_Schedule record exists for a Vehicle, THE Predictive_Engine SHALL compute `predicted_remaining_km` as (`last_odometer` + `interval_km`) − `current_odometer`.
3. WHEN `predicted_next_service` is within 7 calendar days of the current date, THE Predictive_Engine SHALL set `maintenance_due` to `True` on the Vehicle.
4. WHEN `predicted_remaining_km` is less than 500, THE Predictive_Engine SHALL set `maintenance_due` to `True` on the Vehicle.
5. IF no Maintenance_Schedule record exists for a Vehicle, THEN THE Predictive_Engine SHALL leave `predicted_next_service`, `predicted_remaining_km`, and `maintenance_due` as unset/False.
6. THE Predictive_Engine SHALL recompute `maintenance_due`, `predicted_next_service`, and `predicted_remaining_km` whenever `current_odometer`, `predicted_next_service`, or `predicted_remaining_km` changes.

---

### Requirement 6: Automated Alerts and Notifications

**User Story:** As a fleet manager, I want the system to automatically create Odoo activity alerts for maintenance, tax expiry, and contract expiry, so that I am notified in time to take action without manual monitoring.

#### Acceptance Criteria

1. THE Alert_Scheduler SHALL run as a daily `ir.cron` action that checks all active Vehicles.
2. WHEN a Vehicle's `maintenance_due` is `True` and no open activity of type `mail.activity_type` with summary "Maintenance Due" exists on that Vehicle, THE Alert_Scheduler SHALL create an Odoo activity on the Vehicle assigned to the responsible user.
3. WHEN a Vehicle's `tax_expiry_date` is within 30 calendar days of the current date and no open activity with summary "Tax Expiry" exists on that Vehicle, THE Alert_Scheduler SHALL create an Odoo activity on the Vehicle.
4. WHEN a Vehicle's `contract_expiry_date` is within 30 calendar days of the current date and no open activity with summary "Contract Expiry" exists on that Vehicle, THE Alert_Scheduler SHALL create an Odoo activity on the Vehicle.
5. WHEN a Vehicle's `maintenance_due` is set to `True`, THE Alert_Scheduler SHALL set `availability` to `False` on that Vehicle.
6. THE Alert_Scheduler SHALL NOT create a duplicate activity if an open activity with the same summary already exists on the Vehicle.
7. WHEN a Vehicle's `maintenance_due` is resolved (set back to `False`), THE Alert_Scheduler SHALL set `availability` back to `True` on that Vehicle.

---

### Requirement 7: Cost Dashboard and Graphs

**User Story:** As a fleet manager, I want visual charts of fleet costs and vehicle status, so that I can quickly understand operational spending and fleet composition.

#### Acceptance Criteria

1. THE Dashboard SHALL display a stacked bar chart of monthly Service_Record costs grouped by `service_type` (fuel vs. maintenance) using Odoo's native `graph` view on `mesob.service.record`.
2. THE Dashboard SHALL display a pie chart showing the count of Vehicles grouped by `state_id`.
3. THE Dashboard SHALL display a bar chart showing the count of Vehicles grouped by `tag_ids` (vehicle category).
4. WHEN a user clicks a chart segment, THE Dashboard SHALL drill down to a filtered list view of the underlying records.
5. THE Dashboard SHALL provide date-range filter controls to restrict the cost chart to a selected period.
6. THE Dashboard SHALL be accessible from the main MESSOB Fleet menu as a dedicated "Dashboard" menu item.

---

### Requirement 8: Inventory Module Integration

**User Story:** As a warehouse manager, I want to view and allocate fleet vehicles as assets within the Inventory module, so that I can assign parts and equipment to specific vehicles and maintain a complete allocation history.

#### Acceptance Criteria

1. THE System SHALL expose each Vehicle as a selectable asset reference on `stock.move` records via the `Inventory_Allocation` model, linking `vehicle_id` (Many2one to `fleet.vehicle`) and `product_id` (Many2one to `product.product`).
2. THE System SHALL display a list of related Inventory_Allocation records on the Vehicle form view, showing `product_id`, `quantity`, `stock_move_id`, and `allocation_date`.
3. WHEN a Vehicle record is deleted, THE System SHALL preserve all associated Inventory_Allocation records by setting `vehicle_id` to `False` (i.e., `ondelete='set null'`) rather than cascading the delete.
4. THE System SHALL provide a menu item or smart button on the Vehicle form view that navigates to all `stock.move` records referencing that Vehicle.
5. THE System SHALL allow Inventory_Allocation records to be created from within an internal transfer (`stock.picking`) by selecting a Vehicle from the fleet.
6. WHERE the `stock` module is installed, THE System SHALL add a "Fleet Asset" field to the `stock.move` form view that links to a Vehicle.

---

### Requirement 9: Fuel Consumption Calculation

**User Story:** As a fleet manager, I want the system to calculate average fuel consumption per vehicle, so that I can identify inefficient vehicles and optimise fuel budgets.

#### Acceptance Criteria

1. THE System SHALL compute `fuel_consumption` (L/100 km) for a Vehicle using the formula: `total_fuel_volume / total_distance_km * 100`, where `total_fuel_volume` is the sum of `volume` from all Fuel_Log records for that Vehicle and `total_distance_km` is derived from the difference between the maximum and minimum `odometer` values across those Fuel_Log records.
2. WHEN fewer than 2 Fuel_Log records exist for a Vehicle, THE System SHALL display "Insufficient data" in place of a numeric `fuel_consumption` value.
3. THE System SHALL recompute `fuel_consumption` whenever a Fuel_Log record is created, updated, or deleted for the associated Vehicle.
4. THE System SHALL display `fuel_consumption` on the Vehicle form view with the unit label "L/100 km".
5. FOR ALL Vehicles with at least 2 Fuel_Log records, THE System SHALL produce a `fuel_consumption` value greater than zero when `total_distance_km` is greater than zero.

---

### Requirement 10: Views and User Interface

**User Story:** As a fleet manager, I want consistent, mobile-responsive views for all fleet data, so that I can manage the fleet efficiently from any device.

#### Acceptance Criteria

1. THE System SHALL provide list, form, and Kanban views for the Vehicle model (`fleet.vehicle`).
2. THE System SHALL provide list and form views for the Service_Record model (`mesob.service.record`).
3. THE System SHALL provide list and form views for the Fuel_Log model (`mesob.fuel.log`).
4. THE System SHALL provide list and form views for the Odometer_Reading model (`mesob.odometer.log`).
5. THE System SHALL provide list and form views for the Trip_Request model (`mesob.trip.request`) with the full status state machine: Draft → Pending → Approved/Rejected → In-Progress → Completed → Closed.
6. THE System SHALL provide list and form views for the Trip_Assignment model (`mesob.trip.assignment`).
7. WHILE the viewport width is at least 360 pixels, THE System SHALL render all views without horizontal overflow or truncated fields.
8. THE System SHALL include search filters and group-by options in all list views, covering at minimum: `vehicle_id`, `state_id`/`status`, `date`, and `service_type` where applicable.
9. THE System SHALL include a status bar widget on the Trip_Request form view reflecting the state machine transitions defined in criterion 5.
10. THE System SHALL add a MESSOB-specific tab or section to the native `fleet.vehicle` form view (via `inherit_id`) rather than replacing it, to preserve native Fleet_Module functionality.

---

### Requirement 11: Trip Request and Dispatch Workflow

**User Story:** As a staff member, I want to submit a trip request and have it routed through an approval workflow, so that vehicle use is authorised and tracked end-to-end.

#### Acceptance Criteria

1. THE System SHALL allow any authenticated user to create a Trip_Request with fields: `requester_id`, `purpose`, `vehicle_category_needed`, `start_datetime`, `end_datetime`, `pickup_location`, `dest_location`.
2. WHEN a Trip_Request is submitted, THE System SHALL transition its `status` from `draft` to `pending` and notify the fleet manager via an Odoo activity.
3. WHEN a fleet manager approves a Trip_Request, THE System SHALL transition `status` to `approved` and allow creation of a Trip_Assignment linking a Vehicle and Driver.
4. WHEN a fleet manager rejects a Trip_Request, THE System SHALL transition `status` to `rejected` and record a rejection reason.
5. WHEN a Trip_Assignment is confirmed and the trip begins, THE System SHALL transition the Trip_Request `status` to `in_progress` and set the assigned Vehicle's `availability` to `False`.
6. WHEN a Trip_Log record with `status = 'arrive'` is saved for a Trip_Assignment, THE System SHALL transition the Trip_Request `status` to `completed` and set the Vehicle's `availability` back to `True`.
7. WHEN a Trip_Request reaches `completed` status and is administratively closed, THE System SHALL transition `status` to `closed` and lock the record against further edits.
8. IF a Trip_Request's `start_datetime` is in the past at the time of approval, THEN THE System SHALL display a warning (not a blocking error) to the approving user.
9. THE System SHALL prevent assigning a Vehicle to a Trip_Assignment when that Vehicle's `availability` is `False`.

---

### Requirement 12: Technical Documentation and Code Quality

**User Story:** As a developer maintaining this module, I want inline documentation and structured XML comments, so that the codebase is understandable and maintainable.

#### Acceptance Criteria

1. THE System SHALL include a Python docstring on every model class describing its purpose, fields, and key methods.
2. THE System SHALL include a Python docstring on every non-trivial method (compute methods, constraint methods, scheduled actions) describing its inputs, outputs, and side effects.
3. THE System SHALL include an XML comment header in every view file identifying the file name, module, and a brief description of the views it contains.
4. THE System SHALL define all custom security groups in `security/security.xml` with at least the following roles: Fleet Manager, Fleet User, and Fleet Read-Only.
5. THE System SHALL define access control rules for every custom model in `security/ir.model.access.csv`, granting appropriate read/write/create/unlink permissions per security group.
6. THE System SHALL declare all external module dependencies (`fleet`, `hr`, `stock`, `mail`) in `__manifest__.py` under the `depends` key.
