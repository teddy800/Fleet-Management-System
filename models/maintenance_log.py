from odoo import models, fields


class MaintenanceLog(models.Model):
    """Audit trail of completed maintenance events for a vehicle."""

    _name = 'mesob.maintenance.log'
    _description = 'Maintenance Log'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    date = fields.Date()
    type = fields.Char()
    description = fields.Text()
    cost = fields.Float()
    service_provider = fields.Char()
    next_due_odometer = fields.Float()
