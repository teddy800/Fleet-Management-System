from datetime import timedelta

from odoo import models, fields, api
from odoo.exceptions import ValidationError


class FleetVehicle(models.Model):
    """Extension of fleet.vehicle for the MESSOB Fleet Management System.

    Adds HR-sourced driver assignment, predictive maintenance engine,
    fuel consumption analytics, automated alert scheduling, and
    inventory/stock move integration.
    """

    _inherit = 'fleet.vehicle'

    # 2.1 Custom fields
    driver_id = fields.Many2one(
        'hr.employee',
        string="Driver",
        domain=[('active', '=', True)],
        context={'no_create': True},
    )
    availability = fields.Boolean(string="Available", default=True)
    assignment_date = fields.Date(string="Assignment Date")
    tax_expiry_date = fields.Date(string="Tax Expiry Date")
    contract_expiry_date = fields.Date(string="Contract Expiry Date")
    current_odometer = fields.Integer(string="Current Odometer (km)")
    vin = fields.Char(string="VIN")
    location = fields.Char(string="Location")
    purchase_value = fields.Float(string="Purchase Value")
    residual_value = fields.Float(string="Residual Value")

    # One2many back-references
    maintenance_schedule_ids = fields.One2many(
        'mesob.maintenance.schedule', 'vehicle_id', string="Maintenance Schedules"
    )
    fuel_log_ids = fields.One2many(
        'mesob.fuel.log', 'vehicle_id', string="Fuel Logs"
    )

    # 2.2 Computed stored fields
    predicted_next_service = fields.Date(
        string="Predicted Next Service",
        compute='_compute_predicted_fields',
        store=True,
    )
    predicted_remaining_km = fields.Integer(
        string="Predicted Remaining KM",
        compute='_compute_predicted_fields',
        store=True,
    )
    maintenance_due = fields.Boolean(
        string="Maintenance Due",
        compute='_compute_maintenance_due',
        store=True,
    )
    fuel_consumption = fields.Float(
        string="Fuel Consumption (L/100km)",
        compute='_compute_fuel_consumption',
        store=True,
    )

    # 2.3 Predictive engine
    @api.depends(
        'maintenance_schedule_ids.last_service_date',
        'maintenance_schedule_ids.interval_days',
        'maintenance_schedule_ids.last_odometer',
        'maintenance_schedule_ids.interval_km',
        'current_odometer',
    )
    def _compute_predicted_fields(self):
        """Compute predicted_next_service and predicted_remaining_km."""
        for vehicle in self:
            schedule = vehicle.maintenance_schedule_ids[:1]
            if not schedule:
                vehicle.predicted_next_service = False
                vehicle.predicted_remaining_km = False
            else:
                if schedule.last_service_date and schedule.interval_days:
                    vehicle.predicted_next_service = (
                        schedule.last_service_date + timedelta(days=schedule.interval_days)
                    )
                else:
                    vehicle.predicted_next_service = False
                if schedule.interval_km and schedule.last_odometer is not False:
                    vehicle.predicted_remaining_km = int(
                        (schedule.last_odometer + schedule.interval_km) - vehicle.current_odometer
                    )
                else:
                    vehicle.predicted_remaining_km = False

    @api.depends('predicted_next_service', 'predicted_remaining_km')
    def _compute_maintenance_due(self):
        """Set maintenance_due True when service within 7 days or < 500 km remain."""
        today = fields.Date.today()
        threshold = today + timedelta(days=7)
        for vehicle in self:
            due = False
            if vehicle.predicted_next_service and vehicle.predicted_next_service <= threshold:
                due = True
            if vehicle.predicted_remaining_km is not False and vehicle.predicted_remaining_km < 500:
                due = True
            vehicle.maintenance_due = due

    # 2.4 Fuel consumption
    @api.depends('fuel_log_ids.volume', 'fuel_log_ids.odometer')
    def _compute_fuel_consumption(self):
        """Compute average fuel consumption in L/100 km."""
        for vehicle in self:
            logs = vehicle.fuel_log_ids.filtered(lambda l: l.odometer > 0)
            if len(logs) < 2:
                vehicle.fuel_consumption = 0.0
                continue
            total_volume = sum(logs.mapped('volume'))
            min_odo = min(logs.mapped('odometer'))
            max_odo = max(logs.mapped('odometer'))
            distance = max_odo - min_odo
            vehicle.fuel_consumption = (total_volume / distance * 100) if distance > 0 else 0.0

    # 2.5 Constraints
    @api.constrains('license_plate')
    def _check_license_plate(self):
        """Raise ValidationError when license_plate is empty or whitespace-only."""
        for rec in self:
            if not rec.license_plate or not rec.license_plate.strip():
                raise ValidationError("License plate is required.")

    @api.constrains('driver_id')
    def _check_driver_active(self):
        """Raise ValidationError when the assigned driver is an archived employee."""
        for rec in self:
            if rec.driver_id and not rec.driver_id.active:
                raise ValidationError(
                    "Cannot assign an archived employee as driver. "
                    "Please select an active employee."
                )

    # 2.7 Actions and scheduler
    def action_open_stock_moves(self):
        """Return a window action filtered to stock.move records for this vehicle."""
        return {
            'type': 'ir.actions.act_window',
            'name': 'Stock Moves',
            'res_model': 'stock.move',
            'view_mode': 'tree,form',
            'domain': [('vehicle_id', '=', self.id)],
        }

    def _run_alert_scheduler(self):
        """Daily cron: check maintenance, tax, and contract expiry for all active vehicles."""
        today = fields.Date.today()
        expiry_threshold = today + timedelta(days=30)
        activity_type = self.env.ref('mail.mail_activity_data_todo')
        for vehicle in self.search([('active', '=', True)]):
            if vehicle.maintenance_due:
                vehicle.availability = False
                self._create_activity_if_absent(vehicle, "Maintenance Due", activity_type)
            else:
                vehicle.availability = True
            if vehicle.tax_expiry_date and vehicle.tax_expiry_date <= expiry_threshold:
                self._create_activity_if_absent(vehicle, "Tax Expiry", activity_type)
            if vehicle.contract_expiry_date and vehicle.contract_expiry_date <= expiry_threshold:
                self._create_activity_if_absent(vehicle, "Contract Expiry", activity_type)

    def _create_activity_if_absent(self, vehicle, summary, activity_type):
        """Create a mail.activity only when no open activity with the same summary exists."""
        existing = self.env['mail.activity'].search([
            ('res_model', '=', 'fleet.vehicle'),
            ('res_id', '=', vehicle.id),
            ('summary', '=', summary),
        ], limit=1)
        if not existing:
            vehicle.activity_schedule(
                activity_type_id=activity_type.id,
                summary=summary,
                user_id=vehicle.manager_id.id or self.env.uid,
            )


# 2.6 HR employee archive hook

class HrEmployee(models.Model):
    """Extension of hr.employee to auto-unassign drivers when archived."""

    _inherit = 'hr.employee'

    def write(self, vals):
        """Clear driver_id on all vehicles when this employee is archived."""
        result = super().write(vals)
        if 'active' in vals and not vals['active']:
            vehicles = self.env['fleet.vehicle'].search([('driver_id', 'in', self.ids)])
            vehicles.write({'driver_id': False})
        return result
