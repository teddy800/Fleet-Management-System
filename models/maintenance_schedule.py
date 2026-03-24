from odoo import models, fields


class MaintenanceSchedule(models.Model):
    """Stores the service interval configuration for a vehicle.

    One record per vehicle defines when the next maintenance is due,
    both by calendar days and by odometer distance.
    """

    _name = 'mesob.maintenance.schedule'
    _description = 'Maintenance Schedule'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    last_service_date = fields.Date()
    last_odometer = fields.Float()
    interval_km = fields.Float()
    interval_days = fields.Integer()
