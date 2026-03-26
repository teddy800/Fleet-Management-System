from odoo import models, fields

class ServiceRecord(models.Model):
    _name = 'mesob.service.record'
    _description = 'Service Record'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    date = fields.Date()
    cost = fields.Float()
    description = fields.Text()
    service_type = fields.Char()
    fuel_volume = fields.Float()
    odometer = fields.Float()
