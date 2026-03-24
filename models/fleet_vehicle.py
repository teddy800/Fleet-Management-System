from odoo import models, fields, api
from datetime import timedelta

class FleetVehicle(models.Model):
    _inherit = 'fleet.vehicle'

    availability = fields.Boolean(default=True)
    current_odometer = fields.Float()

    maintenance_due = fields.Boolean(
        compute="_compute_maintenance", store=True
    )

    @api.depends('current_odometer')
    def _compute_maintenance(self):
        for rec in self:
            schedule = self.env['mesob.maintenance.schedule'].search(
                [('vehicle_id', '=', rec.id)], limit=1
            )

            if schedule:
                rec.maintenance_due = (
                    rec.current_odometer >=
                    schedule.last_odometer + schedule.interval_km
                )
            else:
                rec.maintenance_due = False

    def _cron_check_maintenance(self):
        for rec in self.search([]):
            if rec.maintenance_due:
                rec.availability = False