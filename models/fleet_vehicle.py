from odoo import models, fields, api
from odoo.exceptions import ValidationError
from datetime import timedelta

class FleetVehicle(models.Model):
    _inherit = 'fleet.vehicle'

    assignment_date = fields.Date()
    tax_expiry_date = fields.Date()
    contract_expiry_date = fields.Date()

    availability = fields.Boolean(default=True, tracking=True)

    current_odometer = fields.Float(tracking=True)

    predicted_next_service = fields.Date(
        compute="_compute_predictive", store=True
    )
    predicted_remaining_km = fields.Float(
        compute="_compute_predictive", store=True
    )
    maintenance_due = fields.Boolean(
        compute="_compute_predictive", store=True
    )

    fuel_consumption = fields.Float(
        compute="_compute_fuel_consumption", store=True
    )

    service_ids = fields.One2many(
        'mesob.service.record', 'vehicle_id'
    )

    fuel_log_ids = fields.One2many(
        'mesob.fuel.log', 'vehicle_id'
    )

    @api.constrains('license_plate')
    def _check_license_plate(self):
        for rec in self:
            if not rec.license_plate:
                raise ValidationError("License plate is required.")

    @api.depends('current_odometer')
    def _compute_predictive(self):
        for rec in self:
            schedule = self.env['mesob.maintenance.schedule'].search(
                [('vehicle_id', '=', rec.id)], limit=1
            )

            if not schedule:
                rec.maintenance_due = False
                continue

            rec.predicted_next_service = (
                schedule.last_service_date +
                timedelta(days=schedule.interval_days)
            )

            rec.predicted_remaining_km = (
                (schedule.last_odometer + schedule.interval_km)
                - rec.current_odometer
            )

            rec.maintenance_due = (
                rec.predicted_remaining_km < 500 or
                rec.predicted_next_service <= fields.Date.today() + timedelta(days=7)
            )

    @api.depends('fuel_log_ids')
    def _compute_fuel_consumption(self):
        for rec in self:
            logs = rec.fuel_log_ids
            if len(logs) < 2:
                rec.fuel_consumption = 0
                continue

            total_fuel = sum(log.volume for log in logs)
            odometers = logs.mapped('odometer')

            distance = max(odometers) - min(odometers)
            rec.fuel_consumption = (total_fuel / distance) * 100 if distance > 0 else 0

    def action_check_maintenance(self):
        for rec in self:
            if rec.maintenance_due:
                rec.activity_schedule(
                    'mail.mail_activity_data_todo',
                    summary='Maintenance Due'
                )
                rec.availability = False