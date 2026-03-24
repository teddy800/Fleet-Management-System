from odoo import models, fields

class MaintenanceSchedule(models.Model):
    _name = 'mesob.maintenance.schedule'

    vehicle_id = fields.Many2one('fleet.vehicle')
    interval_km = fields.Float()
    last_odometer = fields.Float()
    last_service_date = fields.Date()