# Requirements Document

## Introduction

The MESOB Fleet Management System is an Odoo customization module (`mesob_fleet_management`) that provides end-to-end fleet operations management for the MESOB organization. The system covers vehicle request management, dispatcher-controlled approval workflows, asset tracking, fuel and maintenance logging, inventory-fleet cross-linking, and HR synchronization with an external HRMS. The module extends Odoo's native `fleet`, `hr`, `stock`, and `mail` modules and enforces role-based access control across three user roles: Fleet User, Fleet Manager, and Dispatcher.

---

## Glossary

- **System**: The `mesob_fleet_management` Odoo module as a whole.
- **Trip_Request**: A `mesob.trip.request` record representing an employee's request to use a fleet vehicle.
- **Trip_Assignment**: A `mesob.trip.assignment` record linking a Trip_Request to a specific vehicle and driver after dispatcher approval.
- **Trip_Log**: A `mesob.trip.log` record capturing start and end odometer readings for a completed trip.
- **Dispatcher**: An Odoo user belonging to the `group_fleet_dispatcher` security group, responsible for approving or rejecting Trip_Requests and assigning resources.
- **Fleet_Manager**: An Odoo user belonging to `group_fleet_manager`, responsible for vehicle and driver administration and system configuration.
- **Fleet_User**: An Odoo user belonging to `group_fleet_user`, able to submit Trip_Requests and view their own records.
- **Vehicle**: A `fleet.vehicle` record representing a physical vehicle asset managed by the System.
- **Driver**: An `hr.employee` record designated as a driver, originating from HR Sync.
- **Fuel_Log**: A `mesob.fuel.log` record capturing a single refueling event for a Vehicle.
- **Service_Record**: A `mesob.service.record` record capturing a service or repair event for a Vehicle.
- **Maintenance_Schedule**: A `mesob.maintenance.schedule` record defining the odometer interval and date threshold for preventive maintenance of a Vehicle.
- **Maintenance_Log**: A `mesob.maintenance.log` record tracking the full lifecycle of a maintenance or repair job.
- **Odometer_Log**: A `mesob.odometer.log` record capturing a point-in-time odometer reading for a Vehicle.
- **Inventory_Allocation**: A `mesob.inventory.allocation` record linking a Vehicle to a `product.product` (spare part or equipment) with a quantity.
- **HR_Sync**: The mechanism by which `hr.employee` records are created or updated in Odoo from an external HRMS, without manual creation.
- **Availability**: A boolean field on `fleet.vehicle` indicating whether the Vehicle is free to be assigned to a new trip.
- **Efficiency**: Fuel efficiency expressed as kilometers per liter (KM/L), computed from distance driven and fuel volume consumed.
- **Validator**: The constraint and validation layer within the System that enforces business rules on data entry and state transitions.

---

## Requirements

### Requirement 1: Trip Request Lifecycle

**User Story:** As a Fleet User, I want to submit a vehicle request and track its progress through a defined workflow, so that I can plan travel and know the current status of my request at all times.

#### Acceptance Criteria

1. THE Trip_Request SHALL support the following states in order: `draft`, `pending`, `approved`, `rejected`, `in_progress`, `completed`, `closed`.
2. WHEN a Fleet_User submits a Trip_Request in `draft` state, THE Trip_Request SHALL transition to `pending` state and record a timestamp on the `submitted_at` field.
3. WHEN a Dispatcher approves a Trip_Request in `pending` state, THE Trip_Request SHALL transition to `approved` state and record a timestamp on the `approved_at` field.
4. WHEN a Dispatcher rejects a Trip_Request in `pending` state, THE Trip_Request SHALL transition to `rejected` state, record a timestamp on the `rejected_at` field, and store the rejection reason provided by the Dispatcher.
5. WHEN a Trip_Assignment is confirmed for an `approved` Trip_Request, THE Trip_Request SHALL transition to `in_progress` state and record a timestamp on the `started_at` field.
6. WHEN a Fleet_User or Fleet_Manager marks an `in_progress` Trip_Request as complete, THE Trip_Request SHALL transition to `completed` state and record a timestamp on the `completed_at` field.
7. WHEN a Fleet_Manager closes a `completed` Trip_Request, THE Trip_Request SHALL transition to `closed` state and record a timestamp on the `closed_at` field.
8. WHEN a Fleet_User attempts to cancel a Trip_Request that is NOT in `pending` state, THE Validator SHALL raise a validation error and prevent the cancellation.
9. WHEN a Fleet_User cancels a Trip_Request in `pending` state, THE Trip_Request SHALL transition to `draft` state and clear the `submitted_at` timestamp.
10. IF a state transition is attempted that is not defined in the workflow above, THEN THE Validator SHALL raise a validation error and leave the Trip_Request state unchanged.

---

### Requirement 2: Trip Request Data Fields

**User Story:** As a Fleet User, I want to provide complete trip details when submitting a request, so that the Dispatcher has all the information needed to make an assignment decision.

#### Acceptance Criteria

1. THE Trip_Request SHALL require the following fields on submission: `requester_id` (linked to the submitting `res.users`), `purpose` (text description of the trip purpose), `justification` (text), `vehicle_category_id` (preferred vehicle category), `pickup_location` (text), `destination_location` (text), `start_date` (datetime), `end_date` (datetime).
2. WHEN `start_date` is set to a value greater than or equal to `end_date`, THE Validator SHALL raise a validation error indicating that the end date must be after the start date.
3. THE Trip_Request SHALL display a color-coded status indicator in list and kanban views, mapping each state to a distinct color: `draft` = grey, `pending` = blue, `approved` = green, `rejected` = red, `in_progress` = orange, `completed` = teal, `closed` = dark grey.
4. THE Trip_Request SHALL expose a personal dashboard view filtered to show only the records where `requester_id` matches the currently authenticated user.

---

### Requirement 3: Dispatcher Approval & Resource Assignment

**User Story:** As a Dispatcher, I want to review pending trip requests and assign available vehicles and drivers, so that fleet resources are allocated efficiently without conflicts.

#### Acceptance Criteria

1. THE System SHALL restrict the `action_approve` and `action_reject` methods on Trip_Request to users in the `group_fleet_dispatcher` group; any other user invoking these methods SHALL receive an `AccessError`.
2. WHEN a Dispatcher opens the assignment form for a Trip_Request, THE System SHALL display only Vehicles whose `availability` field is `True` and whose category matches the `vehicle_category_id` of the Trip_Request and that have no confirmed Trip_Assignment overlapping the requested `start_date` to `end_date` window.
3. WHEN a Dispatcher opens the assignment form for a Trip_Request, THE System SHALL display only Drivers whose `hr.employee` records are active and who have no confirmed Trip_Assignment overlapping the requested `start_date` to `end_date` window.
4. WHEN a Dispatcher confirms a Trip_Assignment that would assign a Vehicle already assigned to another active Trip_Request with an overlapping date range, THE Validator SHALL raise a validation error and prevent the assignment (BR-2).
5. WHEN a Dispatcher confirms a Trip_Assignment that would assign a Driver already assigned to another active Trip_Request with an overlapping date range, THE Validator SHALL raise a validation error and prevent the assignment (BR-3).
6. THE System SHALL present pending Trip_Requests in a priority queue view sorted by `submitted_at` ascending (oldest first) by default, with the ability to filter by vehicle category, requested date range, and requester department.
7. THE System SHALL provide a fleet availability calendar/timeline view showing each Vehicle's assigned trips and maintenance windows across a selectable date range.

---

### Requirement 4: Vehicle Asset Management

**User Story:** As a Fleet Manager, I want to maintain complete lifecycle records for each vehicle, so that I can track asset status, schedule maintenance, and report on fleet utilization.

#### Acceptance Criteria

1. THE Vehicle SHALL store the following fields: VIN, plate number, make, model, year, acquisition date, fuel type, `current_odometer`, `availability`, and `maintenance_due`.
2. WHEN `current_odometer` is updated on a Vehicle, THE System SHALL recompute `maintenance_due` as `True` if `current_odometer >= last_odometer + interval_km` from the associated Maintenance_Schedule, and `False` otherwise.
3. WHEN the `_cron_check_maintenance` scheduled action runs, THE System SHALL set `availability` to `False` for every Vehicle where `maintenance_due` is `True`.
4. THE Odometer_Log SHALL record each odometer update with `vehicle_id`, `date`, and `value` fields.
5. WHEN a new Odometer_Log entry is created for a Vehicle with a `value` less than the Vehicle's current `current_odometer`, THE Validator SHALL raise a validation error indicating that odometer readings cannot decrease.

---

### Requirement 5: Fuel Logging & Efficiency

**User Story:** As a Fleet Manager, I want to log every refueling event with full details and automatically compute fuel efficiency, so that I can monitor consumption trends per vehicle.

#### Acceptance Criteria

1. THE Fuel_Log SHALL store: `vehicle_id`, `driver_id` (linked to `hr.employee`), `date`, `fuel_station` (text), `volume` (liters, float), `cost` (float), `odometer` (float at time of refueling).
2. WHEN a Fuel_Log record is saved, THE System SHALL compute `efficiency` as `(odometer - previous_odometer) / volume` where `previous_odometer` is the `odometer` value of the most recent prior Fuel_Log for the same Vehicle; IF no prior Fuel_Log exists, THEN THE System SHALL set `efficiency` to `0.0`.
3. WHEN `volume` is set to a value less than or equal to `0`, THE Validator SHALL raise a validation error.
4. WHEN `cost` is set to a value less than `0`, THE Validator SHALL raise a validation error.

---

### Requirement 6: Maintenance Scheduling & Logging

**User Story:** As a Fleet Manager, I want to schedule preventive maintenance and log all repair work with parts and costs, so that vehicles remain in safe operating condition.

#### Acceptance Criteria

1. THE Maintenance_Schedule SHALL store: `vehicle_id`, `interval_km` (float), `last_odometer` (float), `last_service_date` (date).
2. THE Maintenance_Log SHALL support the following states: `draft`, `in_progress`, `done`, `cancel`.
3. WHEN a Maintenance_Log transitions to `in_progress`, THE System SHALL set the associated Vehicle's `availability` to `False`.
4. WHEN a Maintenance_Log transitions to `done`, THE System SHALL set the associated Vehicle's `availability` to `True` and update the Vehicle's `current_odometer` to the `odometer` value recorded in the Maintenance_Log.
5. WHEN a Maintenance_Log transitions to `done`, THE System SHALL update the associated Maintenance_Schedule's `last_odometer` to the Maintenance_Log's `odometer` value and `last_service_date` to the Maintenance_Log's `date`.
6. THE Maintenance_Log SHALL reference zero or more Inventory_Allocation records as `parts_ids` to capture parts consumed during the job.
7. WHEN `cost` on a Maintenance_Log is set to a value less than `0`, THE Validator SHALL raise a validation error.
8. THE Maintenance_Log SHALL use `mail.thread` to track all state changes and field updates as chatter messages.

---

### Requirement 7: Service Records

**User Story:** As a Fleet Manager, I want to record all service events for a vehicle in a structured format, so that I have a complete service history for auditing and resale purposes.

#### Acceptance Criteria

1. THE Service_Record SHALL store: `vehicle_id`, `date`, `cost`, `description`, `service_type` (selection: `routine`, `repair`, `inspection`, `emergency`), `fuel_volume`, `odometer`.
2. THE Service_Record SHALL be linkable from a Maintenance_Log via the `service_record_id` field.
3. WHEN `cost` on a Service_Record is set to a value less than `0`, THE Validator SHALL raise a validation error.

---

### Requirement 8: Inventory-Fleet Cross-Linking

**User Story:** As a Fleet Manager, I want to allocate spare parts and equipment from inventory to specific vehicles, so that parts consumption is tracked against the correct asset.

#### Acceptance Criteria

1. THE Inventory_Allocation SHALL store: `vehicle_id` (linked to `fleet.vehicle`), `product_id` (linked to `product.product`), `quantity` (float), `maintenance_log_id` (linked to `mesob.maintenance.log`, optional).
2. WHEN `quantity` on an Inventory_Allocation is set to a value less than or equal to `0`, THE Validator SHALL raise a validation error.
3. THE System SHALL allow users with the `stock` module's inventory access to view and create Inventory_Allocation records from within the Inventory module context.
4. WHEN a Maintenance_Log is viewed, THE System SHALL display all associated Inventory_Allocation records as a sub-list showing `product_id`, `quantity`, and unit of measure.

---

### Requirement 9: HR Synchronization

**User Story:** As a System Administrator, I want employee records to be synchronized from the external HRMS into Odoo automatically, so that no staff member needs to be created manually and driver data is always current.

#### Acceptance Criteria

1. THE System SHALL provide an HTTP endpoint or scheduled action (`_cron_sync_employees`) that receives or fetches employee data from the external HRMS and creates or updates `hr.employee` records in Odoo.
2. WHEN an employee record is received from the external HRMS, THE System SHALL match on a unique external identifier field (`external_hr_id`) and update the existing `hr.employee` record if a match exists, or create a new one if no match exists.
3. WHEN an `hr.employee` record is created via HR Sync, THE System SHALL set a boolean field `synced_from_hr` to `True` on that record.
4. THE System SHALL prevent manual creation of `hr.employee` records by users in `group_fleet_user` and `group_fleet_dispatcher`; only `group_fleet_manager` and System Administrators SHALL have create permission on `hr.employee` within the module's access rules.
5. WHEN the HR Sync process encounters a malformed or incomplete employee payload, THE System SHALL log the error to the Odoo server log and skip that record without aborting the full sync.

---

### Requirement 10: Role-Based Access Control

**User Story:** As a System Administrator, I want clearly defined access roles with appropriate permissions, so that users can only perform actions relevant to their responsibilities.

#### Acceptance Criteria

1. THE System SHALL define three security groups: `group_fleet_user`, `group_fleet_dispatcher`, and `group_fleet_manager`.
2. THE System SHALL configure `ir.model.access` rules so that `group_fleet_user` has read and create access on Trip_Request, and read-only access on Vehicle, Driver, and Fuel_Log records.
3. THE System SHALL configure `ir.model.access` rules so that `group_fleet_dispatcher` has read, write, and create access on Trip_Request and Trip_Assignment, and read-only access on Vehicle and Driver records.
4. THE System SHALL configure `ir.model.access` rules so that `group_fleet_manager` has full read, write, create, and delete access on all models defined in the module.
5. THE System SHALL remove the current unrestricted (no-group) access rules from `ir.model.access.csv` and replace them with group-scoped rules.
6. WHEN a user not in `group_fleet_dispatcher` or `group_fleet_manager` attempts to write to a Trip_Assignment record, THE System SHALL raise an `AccessError`.

---

### Requirement 11: Audit Logging

**User Story:** As a Fleet Manager, I want all significant state changes and field modifications to be recorded with user and timestamp information, so that I can audit the history of any record.

#### Acceptance Criteria

1. THE Trip_Request SHALL inherit `mail.thread` and use `tracking=True` on the `state`, `vehicle_id`, `driver_id`, `start_date`, and `end_date` fields.
2. THE Maintenance_Log SHALL inherit `mail.thread` and use `tracking=True` on the `state`, `vehicle_id`, `technician_id`, `cost`, and `odometer` fields.
3. WHEN any tracked field on a Trip_Request or Maintenance_Log is modified, THE System SHALL create a chatter message recording the old value, new value, field name, modifying user, and timestamp.
4. THE System SHALL retain chatter messages for Trip_Request and Maintenance_Log records indefinitely unless explicitly deleted by a user with `group_fleet_manager` permissions.
